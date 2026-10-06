import { it, expect, vi, beforeEach, afterEach, describe } from 'vitest';
const m = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
  participants: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
  mute: vi.fn(),
  metadata: vi.fn(),
  deleted: vi.fn(),
  grant: vi.fn(),
  tokenOptions: vi.fn(),
  serviceUrl: vi.fn(),
}));
vi.mock('livekit-server-sdk', () => ({
  TrackSource: { MICROPHONE: 2, SCREEN_SHARE: 3, SCREEN_SHARE_AUDIO: 4 },
  RoomServiceClient: class {
    constructor(url: string) {
      m.serviceUrl(url);
    }
    createRoom = m.create;
    listRooms = m.list;
    listParticipants = m.participants;
    removeParticipant = m.remove;
    updateParticipant = m.update;
    mutePublishedTrack = m.mute;
    updateRoomMetadata = m.metadata;
    deleteRoom = m.deleted;
  },
  AccessToken: class {
    constructor(_key: string, _secret: string, options: unknown) {
      m.tokenOptions(options);
    }
    addGrant = m.grant;
    async toJwt() {
      return 'temporary-token';
    }
  },
}));
import { roomAction, RedisRoomStore, liveKitReachable, type RoomStore } from '@/lib/screen/rooms';
import { RedisUnavailable, type SiteRedis } from '@/lib/server/redis';

const host = { discordId: '123456789012345678', name: 'Host' },
  viewer = { discordId: '223456789012345678', name: 'Viewer' },
  third = { discordId: '323456789012345678', name: 'Third' };
const SECRET = 'livekit-secret-value-never-in-client';
const MIC = 2,
  SCREEN = 3,
  SCREEN_AUDIO = 4;
// Participantes conectados na LiveKit (fonte da presença real).
let connected: { identity: string; tracks: { sid: string; source: number }[] }[];
let store: RoomStore;

/** Redis em memória com as mesmas operações usadas pelo store e pelo lock (SET NX + EVAL). */
function fakeRedis(fail = false): SiteRedis {
  const hash = new Map<string, string>();
  const strings = new Map<string, string>();
  const client = {
    hVals: async () => [...hash.values()],
    hGet: async (_: string, code: string) => hash.get(code) ?? null,
    hDel: async (_: string, code: string) => Number(hash.delete(code)),
    multi() {
      const ops: (() => void)[] = [];
      const chain = {
        hSet: (_: string, code: string, value: string) => {
          ops.push(() => hash.set(code, value));
          return chain;
        },
        pExpire: () => chain,
        exec: async () => ops.forEach((op) => op()),
      };
      return chain;
    },
    set: async (key: string, value: string) => (strings.has(key) ? null : (strings.set(key, value), 'OK')),
    eval: async (_: string, { keys }: { keys: string[] }) => Number(strings.delete(keys[0])),
  };
  return {
    key: (name) => 'suburbio:site:' + name,
    run: async (_op, action) => {
      if (fail) throw new RedisUnavailable('down');
      return action(client as never);
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('LIVEKIT_ENABLED', 'true');
  vi.stubEnv('LIVEKIT_INTERNAL_URL', 'http://127.0.0.1:7880');
  vi.stubEnv('LIVEKIT_PUBLIC_URL', 'wss://tela.example.com');
  vi.stubEnv('LIVEKIT_API_KEY', 'local-key');
  vi.stubEnv('LIVEKIT_API_SECRET', SECRET);
  vi.stubEnv('LIVEKIT_ROOM_MAX_PARTICIPANTS', '10');
  vi.stubEnv('REDIS_URL', 'redis://127.0.0.1:6379');
  connected = [];
  for (const fn of [m.create, m.remove, m.update, m.mute, m.metadata, m.deleted]) fn.mockResolvedValue(undefined);
  m.list.mockResolvedValue([{ name: 'room' }]);
  m.participants.mockImplementation(async () => connected);
  store = new RedisRoomStore(fakeRedis());
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

type Joined = { code: string; host: string; role: string; capacity: number; url: string; token: string };
async function created(capacity?: number) {
  const room = (await roomAction(host, { action: 'create', capacity }, store)) as unknown as Joined;
  connected.push({ identity: host.discordId, tracks: [] });
  return room;
}
async function join(user: typeof viewer, code: string) {
  const room = (await roomAction(user, { action: 'join', code }, store)) as unknown as Joined;
  connected.push({ identity: user.discordId, tracks: [] });
  return room;
}
const lastGrant = () => m.grant.mock.calls.at(-1)![0];

describe('papéis e tokens', () => {
  it('identity, nome e papel saem da sessão; token tem grants mínimos e TTL curto', async () => {
    const room = await created();
    expect(m.tokenOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ identity: host.discordId, name: 'Host', ttl: 60 }),
    );
    expect(lastGrant()).toMatchObject({
      roomJoin: true,
      canSubscribe: true,
      canPublish: true,
      canPublishSources: [SCREEN, SCREEN_AUDIO, MIC],
      canPublishData: false,
      canUpdateOwnMetadata: false,
    });
    expect(lastGrant()).not.toHaveProperty('roomAdmin');
    expect(room.role).toBe('host');
  });
  it('participante só pode publicar microfone e não ganha autoridade de anfitrião', async () => {
    const room = await created();
    const joined = await join(viewer, room.code);
    expect(joined.role).toBe('participant');
    expect(lastGrant()).toMatchObject({ canPublish: true, canPublishSources: [MIC] });
    await expect(roomAction(viewer, { action: 'end', code: room.code }, store)).rejects.toMatchObject({
      code: 'ROOM_HOST_REQUIRED',
    });
    await expect(
      roomAction(viewer, { action: 'share', code: room.code, target: viewer.discordId, enabled: true }, store),
    ).rejects.toMatchObject({ code: 'ROOM_HOST_REQUIRED' });
    expect(m.deleted).not.toHaveBeenCalled();
    expect(m.update).not.toHaveBeenCalled();
  });
  it('anfitrião concede e revoga apresentação; revogar silencia a tela já publicada no servidor', async () => {
    const room = await created();
    await join(viewer, room.code);
    await roomAction(host, { action: 'share', code: room.code, target: viewer.discordId, enabled: true }, store);
    expect(m.update).toHaveBeenLastCalledWith(expect.any(String), viewer.discordId, {
      permission: expect.objectContaining({ canPublishSources: [SCREEN, SCREEN_AUDIO, MIC] }),
    });
    expect((await join(viewer, room.code)).role).toBe('presenter');
    connected[1]!.tracks = [
      { sid: 'TR_screen', source: SCREEN },
      { sid: 'TR_mic', source: MIC },
    ];
    await roomAction(host, { action: 'share', code: room.code, target: viewer.discordId, enabled: false }, store);
    expect(m.update).toHaveBeenLastCalledWith(expect.any(String), viewer.discordId, {
      permission: expect.objectContaining({ canPublishSources: [MIC] }),
    });
    expect(m.mute).toHaveBeenCalledWith(expect.any(String), viewer.discordId, 'TR_screen', true);
    expect(m.mute).not.toHaveBeenCalledWith(expect.any(String), viewer.discordId, 'TR_mic', true);
  });
  it('silenciar bloqueia toda publicação e silencia todas as faixas', async () => {
    const room = await created();
    await join(viewer, room.code);
    connected[1]!.tracks = [{ sid: 'TR_mic', source: MIC }];
    await roomAction(host, { action: 'silence', code: room.code, target: viewer.discordId, enabled: true }, store);
    expect(m.update).toHaveBeenLastCalledWith(expect.any(String), viewer.discordId, {
      permission: expect.objectContaining({ canPublish: false, canPublishSources: [] }),
    });
    expect(m.mute).toHaveBeenCalledWith(expect.any(String), viewer.discordId, 'TR_mic', true);
    await join(viewer, room.code);
    expect(lastGrant()).toMatchObject({ canPublish: false });
  });
  it('ação administrativa sobre participante inexistente ou sobre o próprio anfitrião é recusada', async () => {
    const room = await created();
    await expect(
      roomAction(host, { action: 'kick', code: room.code, target: third.discordId }, store),
    ).rejects.toMatchObject({ code: 'ROOM_NOT_FOUND' });
    await expect(
      roomAction(host, { action: 'kick', code: room.code, target: host.discordId }, store),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});

describe('ciclo da sala', () => {
  it('bloquear entradas impede novos participantes; remover revoga tokens e impede reentrada', async () => {
    const room = await created();
    await roomAction(host, { action: 'lock', code: room.code, enabled: true }, store);
    await expect(roomAction(third, { action: 'join', code: room.code }, store)).rejects.toMatchObject({
      code: 'ROOM_LOCKED',
    });
    await roomAction(host, { action: 'lock', code: room.code, enabled: false }, store);
    await join(viewer, room.code);
    await roomAction(host, { action: 'kick', code: room.code, target: viewer.discordId }, store);
    expect(m.remove).toHaveBeenCalledWith(expect.any(String), viewer.discordId, {
      revokeTokenTs: expect.any(BigInt),
    });
    await expect(roomAction(viewer, { action: 'join', code: room.code }, store)).rejects.toMatchObject({
      code: 'ROOM_NOT_FOUND',
    });
  });
  it('transferência remove o controle do anfitrião anterior', async () => {
    const room = await created();
    await join(viewer, room.code);
    await roomAction(host, { action: 'transfer', code: room.code, target: viewer.discordId }, store);
    await expect(roomAction(host, { action: 'end', code: room.code }, store)).rejects.toMatchObject({
      code: 'ROOM_HOST_REQUIRED',
    });
    await roomAction(viewer, { action: 'end', code: room.code }, store);
    expect(m.deleted).toHaveBeenCalledTimes(1);
    await expect(roomAction(viewer, { action: 'join', code: room.code }, store)).rejects.toMatchObject({
      code: 'ROOM_NOT_FOUND',
    });
  });
  it('sala inexistente e código de sala encerrada pela LiveKit respondem igual (sem enumeração)', async () => {
    await expect(roomAction(viewer, { action: 'join', code: 'ABCDEF1234' }, store)).rejects.toMatchObject({
      code: 'ROOM_NOT_FOUND',
    });
    const room = await created();
    m.list.mockResolvedValue([]);
    await expect(roomAction(viewer, { action: 'join', code: room.code }, store)).rejects.toMatchObject({
      code: 'ROOM_NOT_FOUND',
    });
    expect(await store.get(room.code)).toBeUndefined();
  });
  it('sala expirada é removida da LiveKit e do Redis', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const room = await created();
    vi.setSystemTime(Date.now() + 13 * 3600_000);
    await expect(roomAction(viewer, { action: 'join', code: room.code }, store)).rejects.toMatchObject({
      code: 'ROOM_NOT_FOUND',
    });
    expect(m.deleted).toHaveBeenCalled();
    expect(await store.get(room.code)).toBeUndefined();
  });
  it('criação registra nome, criador, data, estado, capacidade e limites por anfitrião', async () => {
    const room = await created(4);
    const saved = (await store.get(room.code))!;
    expect(saved).toMatchObject({
      title: 'Sala de Host',
      host: host.discordId,
      state: 'open',
      capacity: 4,
      presenters: [],
      silenced: [],
      blocked: [],
    });
    expect(saved.createdAt).toBeLessThanOrEqual(Date.now());
    expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ maxParticipants: 4 }));
    await created();
    await expect(roomAction(host, { action: 'create' }, store)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });
  it.each([1, 11])('capacidade %i fora do limite configurado é recusada', async (capacity) => {
    await expect(roomAction(host, { action: 'create', capacity }, store)).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
  });
  it('sair libera a vaga reservada', async () => {
    const room = await created(2);
    await roomAction(viewer, { action: 'join', code: room.code }, store);
    await roomAction(viewer, { action: 'leave', code: room.code }, store);
    expect(m.remove).toHaveBeenCalledWith(expect.any(String), viewer.discordId);
    await expect(roomAction(third, { action: 'join', code: room.code }, store)).resolves.toMatchObject({
      role: 'participant',
    });
  });
});

describe('capacidade', () => {
  it('sala cheia recusa nova entrada; reconexão da mesma identity não ocupa outra vaga', async () => {
    const room = await created(2);
    await join(viewer, room.code);
    await expect(roomAction(third, { action: 'join', code: room.code }, store)).rejects.toMatchObject({
      code: 'ROOM_FULL',
    });
    // Reload/queda: mesma identity volta sem duplicar.
    await expect(roomAction(viewer, { action: 'join', code: room.code }, store)).resolves.toMatchObject({
      code: room.code,
    });
  });
  it('vaga reservada expira se a conexão nunca chegar na LiveKit', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const room = await created(2);
    await roomAction(viewer, { action: 'join', code: room.code }, store);
    await expect(roomAction(third, { action: 'join', code: room.code }, store)).rejects.toMatchObject({
      code: 'ROOM_FULL',
    });
    vi.setSystemTime(Date.now() + 91_000);
    await expect(roomAction(third, { action: 'join', code: room.code }, store)).resolves.toBeTruthy();
  });
  it('duas entradas simultâneas na última vaga: só uma passa', async () => {
    const room = await created(2);
    const results = await Promise.allSettled([
      roomAction(viewer, { action: 'join', code: room.code }, store),
      roomAction(third, { action: 'join', code: room.code }, store),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected')).toMatchObject({ reason: { code: 'ROOM_FULL' } });
  });
  it('salas de 10 funcionam sem regra específica para 10', async () => {
    const room = await created(10);
    for (let i = 1; i < 10; i++)
      await join({ discordId: `9000000000000000${String(i).padStart(2, '0')}`, name: `P${i}` }, room.code);
    await expect(roomAction(third, { action: 'join', code: room.code }, store)).rejects.toMatchObject({
      code: 'ROOM_FULL',
    });
  });
});

describe('URLs, secrets e indisponibilidade', () => {
  it('SDK do servidor usa o endereço interno; o navegador recebe só a URL WSS pública', async () => {
    const room = await created();
    expect(m.serviceUrl).toHaveBeenCalledWith('http://127.0.0.1:7880');
    expect(room.url).toBe('wss://tela.example.com');
  });
  it('payload do cliente nunca contém chave, secret ou URL interna', async () => {
    const room = await created();
    const joined = await join(viewer, room.code);
    for (const payload of [room, joined]) {
      const text = JSON.stringify(payload);
      expect(text).not.toContain(SECRET);
      expect(text).not.toContain('local-key');
      expect(text).not.toContain('127.0.0.1');
      expect(Object.keys(payload).sort()).toEqual([
        'capacity',
        'code',
        'host',
        'locked',
        'role',
        'title',
        'token',
        'url',
      ]);
    }
  });
  it('transmissão desligada falha fechada antes de tocar no SDK', async () => {
    vi.stubEnv('LIVEKIT_ENABLED', 'false');
    await expect(roomAction(host, { action: 'create' }, store)).rejects.toMatchObject({ code: 'ROOM_UNAVAILABLE' });
    expect(m.create).not.toHaveBeenCalled();
    expect(await liveKitReachable()).toBe('down');
  });
  it('configuração LiveKit ausente vira ROOM_UNAVAILABLE sem expor detalhes', async () => {
    vi.stubEnv('LIVEKIT_API_SECRET', '');
    await expect(roomAction(host, { action: 'create' }, store)).rejects.toMatchObject({ code: 'ROOM_UNAVAILABLE' });
    expect(m.create).not.toHaveBeenCalled();
  });
  it('LiveKit fora vira ROOM_UNAVAILABLE sem vazar o erro do SDK', async () => {
    m.create.mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:7880'));
    await expect(roomAction(host, { action: 'create' }, store)).rejects.toMatchObject({
      code: 'ROOM_UNAVAILABLE',
      message: expect.not.stringContaining('127.0.0.1'),
    });
  });
  it('readiness da LiveKit: up quando a API responde, down quando falha', async () => {
    expect(await liveKitReachable()).toBe('up');
    m.list.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    expect(await liveKitReachable()).toBe('down');
  });
});

describe('Redis', () => {
  it('salas persistem entre instâncias do store (restart / segunda instância)', async () => {
    const redis = fakeRedis();
    const room = (await roomAction(host, { action: 'create' }, new RedisRoomStore(redis))) as unknown as Joined;
    await expect(
      roomAction(viewer, { action: 'join', code: room.code }, new RedisRoomStore(redis)),
    ).resolves.toMatchObject({ code: room.code });
  });
  it('Redis fora falha fechado e não cria sala na LiveKit', async () => {
    await expect(roomAction(host, { action: 'create' }, new RedisRoomStore(fakeRedis(true)))).rejects.toMatchObject({
      code: 'ROOM_UNAVAILABLE',
    });
    expect(m.create).not.toHaveBeenCalled();
  });
  it('sem Redis configurado não há fallback em memória', async () => {
    vi.stubEnv('REDIS_URL', '');
    await expect(roomAction(host, { action: 'create' })).rejects.toMatchObject({ code: 'ROOM_UNAVAILABLE' });
    expect(m.create).not.toHaveBeenCalled();
  });
});
