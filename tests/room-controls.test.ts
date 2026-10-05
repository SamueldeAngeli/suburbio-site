import { it, expect, vi, beforeEach, afterEach, describe } from 'vitest';
const m = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
  participants: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
  metadata: vi.fn(),
  deleted: vi.fn(),
  grant: vi.fn(),
  serviceUrl: vi.fn(),
}));
vi.mock('livekit-server-sdk', () => ({
  RoomServiceClient: class {
    constructor(url: string) {
      m.serviceUrl(url);
    }
    createRoom = m.create;
    listRooms = m.list;
    listParticipants = m.participants;
    removeParticipant = m.remove;
    updateParticipant = m.update;
    updateRoomMetadata = m.metadata;
    deleteRoom = m.deleted;
  },
  AccessToken: class {
    addGrant = m.grant;
    async toJwt() {
      return 'temporary-token';
    }
  },
}));
import { roomAction, MemoryRoomStore, RedisRoomStore, type RoomStore } from '@/lib/screen/rooms';
import { RedisUnavailable, type SiteRedis } from '@/lib/server/redis';

const host = { discordId: '123456789012345678', name: 'Host' },
  viewer = { discordId: '223456789012345678', name: 'Viewer' };
const SECRET = 'livekit-secret-value-never-in-client';
let store: RoomStore;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('LIVEKIT_ENABLED', 'true');
  vi.stubEnv('LIVEKIT_INTERNAL_URL', 'http://127.0.0.1:7880');
  vi.stubEnv('LIVEKIT_PUBLIC_URL', 'wss://tela.example.com');
  vi.stubEnv('LIVEKIT_API_KEY', 'local-key');
  vi.stubEnv('LIVEKIT_API_SECRET', SECRET);
  vi.stubEnv('REDIS_URL', '');
  m.list.mockResolvedValue([{ name: 'room' }]);
  m.participants.mockResolvedValue([{ identity: host.discordId }, { identity: viewer.discordId }]);
  (globalThis as typeof globalThis & { suburbioRooms?: Map<string, unknown> }).suburbioRooms?.clear();
  store = new MemoryRoomStore();
});
afterEach(() => vi.unstubAllEnvs());

async function created() {
  const room = await roomAction(host, { action: 'create' }, store);
  if (!('token' in room)) throw Error('room not created');
  return room;
}

it('all participants can publish by default without gaining host authority', async () => {
  const room = await created();
  await roomAction(viewer, { action: 'join', code: room.code }, store);
  expect(m.grant).toHaveBeenLastCalledWith(
    expect.objectContaining({ canPublish: true, canSubscribe: true, canPublishData: false }),
  );
  await expect(roomAction(viewer, { action: 'end', code: room.code }, store)).rejects.toMatchObject({
    code: 'ROOM_HOST_REQUIRED',
  });
  expect(m.deleted).not.toHaveBeenCalled();
});

it('lock blocks new participants and kick blocks token renewal', async () => {
  const room = await created();
  await roomAction(host, { action: 'lock', code: room.code, enabled: true }, store);
  await expect(roomAction(viewer, { action: 'join', code: room.code }, store)).rejects.toMatchObject({
    code: 'ROOM_LOCKED',
  });
  await roomAction(host, { action: 'kick', code: room.code, target: viewer.discordId }, store);
  await expect(roomAction(viewer, { action: 'join', code: room.code }, store)).rejects.toMatchObject({
    code: 'ROOM_NOT_FOUND',
  });
});

it('host transfer removes former host control', async () => {
  const room = await created();
  await roomAction(viewer, { action: 'join', code: room.code }, store);
  await roomAction(host, { action: 'transfer', code: room.code, target: viewer.discordId }, store);
  await expect(roomAction(host, { action: 'end', code: room.code }, store)).rejects.toMatchObject({
    code: 'ROOM_HOST_REQUIRED',
  });
  await roomAction(viewer, { action: 'end', code: room.code }, store);
  expect(m.deleted).toHaveBeenCalledTimes(1);
});

describe('LiveKit URLs and secrets', () => {
  it('server SDK uses the internal address while the browser receives only the public WSS URL', async () => {
    const room = await created();
    expect(m.serviceUrl).toHaveBeenCalledWith('http://127.0.0.1:7880');
    expect(room.url).toBe('wss://tela.example.com');
  });

  it('client payload never contains the API key, secret or internal URL', async () => {
    const room = await created();
    const joined = await roomAction(viewer, { action: 'join', code: room.code }, store);
    for (const payload of [room, joined]) {
      const text = JSON.stringify(payload);
      expect(text).not.toContain(SECRET);
      expect(text).not.toContain('local-key');
      expect(text).not.toContain('127.0.0.1');
      expect(Object.keys(payload).sort()).toEqual(['code', 'host', 'locked', 'token', 'url']);
    }
  });

  it('disabled LiveKit fails closed before touching the SDK', async () => {
    vi.stubEnv('LIVEKIT_ENABLED', 'false');
    await expect(roomAction(host, { action: 'create' }, store)).rejects.toMatchObject({ code: 'ROOM_UNAVAILABLE' });
    expect(m.create).not.toHaveBeenCalled();
  });

  it('LiveKit outage becomes ROOM_UNAVAILABLE without leaking the SDK error', async () => {
    m.create.mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:7880'));
    await expect(roomAction(host, { action: 'create' }, store)).rejects.toMatchObject({
      code: 'ROOM_UNAVAILABLE',
      message: expect.not.stringContaining('127.0.0.1'),
    });
  });
});

describe('Redis room store', () => {
  function fakeRedis(fail = false): SiteRedis {
    const hash = new Map<string, string>();
    const strings = new Map<string, string>();
    const client = {
      hVals: async () => [...hash.values()],
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

  it('rooms persist across store instances (restart / second instance)', async () => {
    const redis = fakeRedis();
    const room = await roomAction(host, { action: 'create' }, new RedisRoomStore(redis));
    if (!('code' in room)) throw Error();
    await expect(
      roomAction(viewer, { action: 'join', code: room.code }, new RedisRoomStore(redis)),
    ).resolves.toMatchObject({ code: room.code });
  });

  it('Redis outage fails closed for room authority', async () => {
    await expect(roomAction(host, { action: 'create' }, new RedisRoomStore(fakeRedis(true)))).rejects.toMatchObject({
      code: 'ROOM_UNAVAILABLE',
    });
    expect(m.create).not.toHaveBeenCalled();
  });
});
