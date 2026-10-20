import 'server-only';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { AccessToken, RoomServiceClient, TrackSource, type ParticipantInfo } from 'livekit-server-sdk';
import { SiteError } from '@/lib/api/errors';
import { serverEnv } from '@/lib/server/env';
import { logEvent } from '@/lib/server/log';
import { RedisUnavailable, siteRedis, withRedisLock, type SiteRedis } from '@/lib/server/redis';

type Identity = { discordId: string; name?: string | null; image?: string | null };
export type RoomAction =
  'create' | 'join' | 'leave' | 'live' | 'lock' | 'kick' | 'share' | 'silence' | 'transfer' | 'end';
export type RoomRole = 'host' | 'presenter' | 'participant';
// Moderação de transmissões de terceiros: capabilities já existentes no catálogo da API
// (capability dedicada de transmissão é pendência). Ver no admin: PUNISHMENTS_READ.
export const SCREEN_MODERATION_CAPABILITY = 'PUNISHMENTS_WRITE';
export const SCREEN_MODERATION_READ = 'PUNISHMENTS_READ';
export const CATEGORIES = ['gameplay', 'staff', 'suporte', 'evento', 'apresentacao', 'outro'] as const;
export type Category = (typeof CATEGORIES)[number];
export type Visibility = 'public' | 'private';
type Input = {
  action: RoomAction;
  code?: string;
  target?: string;
  enabled?: boolean;
  capacity?: number;
  title?: string;
  description?: string;
  category?: Category;
  visibility?: Visibility;
  invite?: string;
  reason?: string;
};
// isStaff: a rota consulta na API a capability de moderação, só quando alguém tenta encerrar a sala de outro.
type Options = { isStaff?: () => Promise<boolean> };

const snowflake = z.string().regex(/^\d{17,20}$/);
const ids = z.array(snowflake).max(200);
// Avatar só da CDN do Discord (vem da sessão); qualquer outra origem vira null.
const avatar = z
  .string()
  .url()
  .refine((v) => v.startsWith('https://cdn.discordapp.com/'))
  .nullable();
// Estado autoritativo da transmissão (Redis). Validado na leitura: registro corrompido é tratado como inexistente.
// Campos novos têm default para que salas abertas antes desta versão continuem válidas.
const roomSchema = z
  .object({
    code: z.string().regex(/^[A-F0-9]{10}$/),
    name: z.string().regex(/^suburbio-[a-f0-9]{32}$/),
    title: z.string().max(80),
    host: snowflake,
    createdAt: z.number().int(),
    expires: z.number().int(),
    state: z.enum(['open', 'locked']),
    capacity: z.number().int().min(2).max(50),
    presenters: ids,
    silenced: ids,
    blocked: ids,
    admitted: ids,
    reservations: z.record(snowflake, z.number().int()),
    description: z.string().max(280).default(''),
    category: z.enum(CATEGORIES).nullable().default(null),
    visibility: z.enum(['public', 'private']).default('public'),
    inviteKey: z
      .string()
      .regex(/^[a-f0-9]{32}$/)
      .nullable()
      .default(null),
    hostName: z.string().max(64).default('Cidadão'),
    hostAvatar: avatar.default(null),
    startedAt: z.number().int().nullable().default(null),
    hostAwaySince: z.number().int().nullable().default(null),
    peakViewers: z.number().int().min(0).default(0),
  })
  .strict();
export type Room = z.infer<typeof roomSchema>;
// Histórico de transmissões encerradas (só as que chegaram a ficar ao vivo). Sem vídeo: só metadados.
const endedSchema = z
  .object({
    code: z.string(),
    title: z.string(),
    host: snowflake,
    hostName: z.string(),
    hostAvatar: avatar,
    category: z.enum(CATEGORIES).nullable(),
    visibility: z.enum(['public', 'private']),
    startedAt: z.number().int(),
    endedAt: z.number().int(),
    peakViewers: z.number().int(),
    reason: z.enum(['host', 'moderator', 'host_lost', 'closed', 'expired']),
  })
  .strict();
export type EndedBroadcast = z.infer<typeof endedSchema>;
export type EndReason = EndedBroadcast['reason'];

const ROOM_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_ROOMS = 100;
// Uma transmissão aberta por pessoa (identidade Discord da sessão).
const MAX_ROOMS_PER_HOST = 1;
// Sala criada e nunca colocada ao vivo nesse prazo é descartada (sala órfã).
const CREATED_GRACE_MS = 10 * 60 * 1000;
const ENDED_KEEP = 50;
const ENDED_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Varredura (presença do transmissor, pico, limpeza) no máximo a cada 15s, compartilhada entre instâncias.
const SWEEP_EVERY_MS = 15_000;
// O token só precisa valer na conexão; conectado, a LiveKit renova a credencial sozinha.
const TOKEN_TTL_SECONDS = 60;
// Vaga reservada entre a emissão do token e a conexão aparecer na LiveKit.
const RESERVATION_MS = 90_000;
const LOCK_TTL_MS = 10_000;
const MAX_HISTORY = 200;
const PRESENTER_SOURCES = [TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO, TrackSource.MICROPHONE];
// Espectador só assiste: nenhuma fonte de publicação.
const VIEWER_SOURCES: TrackSource[] = [];

export interface RoomStore {
  exclusive<T>(scope: string, task: () => Promise<T>): Promise<T>;
  all(): Promise<Room[]>;
  get(code: string): Promise<Room | undefined>;
  save(room: Room): Promise<void>;
  remove(code: string): Promise<void>;
  addEnded(entry: EndedBroadcast): Promise<void>;
  ended(): Promise<EndedBroadcast[]>;
  /** true se este chamador ganhou a vez de varrer (janela compartilhada). */
  sweepDue(ms: number): Promise<boolean>;
}

const parseWith = <T>(schema: z.ZodType<T>, value: string | null | undefined) => {
  if (!value) return undefined;
  try {
    const parsed = schema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
};
const parseRoom = (value: string | null | undefined) => parseWith(roomSchema, value);

/** Transmissões no Redis do site: sobrevivem a restart e são compartilhadas entre instâncias. */
export class RedisRoomStore implements RoomStore {
  constructor(private redis: SiteRedis) {}
  private get key() {
    return this.redis.key('livekit:rooms');
  }
  private get endedKey() {
    return this.redis.key('livekit:ended');
  }
  /** Lock por sala (entrada, saída, moderação) e um lock só para criação (limites globais). */
  exclusive<T>(scope: string, task: () => Promise<T>) {
    return withRedisLock(this.redis, `livekit:${scope}`, LOCK_TTL_MS, task);
  }
  async all() {
    const values = await this.redis.run('rooms.all', (c) => c.hVals(this.key));
    return values.flatMap((value) => parseRoom(value) ?? []);
  }
  async get(code: string) {
    return parseRoom(await this.redis.run('rooms.get', (c) => c.hGet(this.key, code)));
  }
  async save(room: Room) {
    await this.redis.run('rooms.save', (c) =>
      c
        .multi()
        .hSet(this.key, room.code, JSON.stringify(room))
        .pExpire(this.key, ROOM_TTL_MS + 3_600_000)
        .exec(),
    );
  }
  async remove(code: string) {
    await this.redis.run('rooms.remove', (c) => c.hDel(this.key, code));
  }
  async addEnded(entry: EndedBroadcast) {
    await this.redis.run('rooms.ended.add', (c) =>
      c
        .multi()
        .lPush(this.endedKey, JSON.stringify(entry))
        .lTrim(this.endedKey, 0, ENDED_KEEP - 1)
        .pExpire(this.endedKey, ENDED_TTL_MS)
        .exec(),
    );
  }
  async ended() {
    const values = await this.redis.run('rooms.ended', (c) => c.lRange(this.endedKey, 0, ENDED_KEEP - 1));
    return values.flatMap((value) => parseWith(endedSchema, value) ?? []);
  }
  async sweepDue(ms: number) {
    const won = await this.redis.run('rooms.sweep', (c) =>
      c.set(this.redis.key('livekit:sweep'), '1', { NX: true, PX: ms }),
    );
    return won === 'OK';
  }
}

export function liveKitConfig() {
  const env = serverEnv();
  if (!env.LIVEKIT_ENABLED) throw new SiteError('ROOM_UNAVAILABLE');
  const internal = env.LIVEKIT_INTERNAL_URL!.replace(/^ws/, 'http');
  return {
    publicUrl: env.LIVEKIT_PUBLIC_URL!,
    key: env.LIVEKIT_API_KEY!,
    secret: env.LIVEKIT_API_SECRET!,
    maxCapacity: env.LIVEKIT_ROOM_MAX_PARTICIPANTS,
    hostGraceMs: env.LIVEKIT_HOST_GRACE_SECONDS * 1000,
    client: new RoomServiceClient(internal, env.LIVEKIT_API_KEY!, env.LIVEKIT_API_SECRET!),
  };
}
type Config = ReturnType<typeof liveKitConfig>;

function defaultStore(): RoomStore {
  const redis = siteRedis();
  // A validação do ambiente já exige REDIS_URL com LIVEKIT_ENABLED; sem Redis não há sala.
  if (!redis) throw new SiteError('ROOM_UNAVAILABLE');
  return new RedisRoomStore(redis);
}

/** Readiness: a API da LiveKit responde (não abre conexão WebRTC). */
export async function liveKitReachable(timeoutMs = 1500): Promise<'up' | 'down'> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const { client } = liveKitConfig();
    await Promise.race([
      client.listRooms(['suburbio-readiness']),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      }),
    ]);
    return 'up';
  } catch {
    return 'down';
  } finally {
    clearTimeout(timer);
  }
}

async function guarded<T>(operation: string, task: () => Promise<T>) {
  const started = performance.now();
  try {
    return await task();
  } catch (error) {
    if (error instanceof SiteError) throw error;
    logEvent(error instanceof RedisUnavailable ? 'warn' : 'error', 'screen.room.unavailable', {
      service: error instanceof RedisUnavailable ? 'redis' : 'livekit',
      operation,
      durationMs: Math.round(performance.now() - started),
    });
    throw new SiteError('ROOM_UNAVAILABLE');
  }
}

export async function roomAction(user: Identity, input: Input, injected?: RoomStore, options: Options = {}) {
  return guarded(input.action, async () => {
    const config = liveKitConfig();
    const store = injected ?? defaultStore();
    if (input.action !== 'create' && !input.code) throw new SiteError('INVALID_INPUT', 400);
    const scope = input.action === 'create' ? 'rooms:create' : `room:${input.code}`;
    return store.exclusive(scope, () => execute(user, input, store, config, options));
  });
}

function roleOf(room: Room, identity: string): RoomRole {
  if (identity === room.host) return 'host';
  return room.presenters.includes(identity) ? 'presenter' : 'participant';
}
/** Permissões mínimas: tela/áudio só para quem transmite (e apresentadores); espectador só assiste. */
function permissionsFor(room: Room, identity: string) {
  const silenced = room.silenced.includes(identity);
  const sources = silenced ? [] : roleOf(room, identity) === 'participant' ? VIEWER_SOURCES : PRESENTER_SOURCES;
  return {
    canSubscribe: true,
    canPublish: sources.length > 0,
    canPublishSources: sources,
    canPublishData: false,
    canUpdateMetadata: false,
  };
}

const remember = (list: string[], id: string) => (list.includes(id) ? list : [...list, id].slice(-MAX_HISTORY));
const without = (list: string[], id: string) => list.filter((value) => value !== id);
// Metadados visíveis aos participantes (só para exibir estado; a autorização é o grant da LiveKit).
const metadata = (room: Room) =>
  JSON.stringify({
    host: room.host,
    hostName: room.hostName,
    hostAvatar: room.hostAvatar,
    title: room.title,
    startedAt: room.startedAt,
    locked: room.state === 'locked',
    capacity: room.capacity,
    presenters: room.presenters,
    silenced: room.silenced,
  });
const roomView = (room: Room, identity: string) => ({
  code: room.code,
  title: room.title,
  description: room.description,
  category: room.category,
  visibility: room.visibility,
  host: room.host,
  hostName: room.hostName,
  hostAvatar: room.hostAvatar,
  startedAt: room.startedAt,
  locked: room.state === 'locked',
  capacity: room.capacity,
  role: roleOf(room, identity),
  // O convite da sala privada só volta para quem transmite.
  ...(identity === room.host && room.inviteKey ? { invite: room.inviteKey } : {}),
});
const sameSecret = (expected: string | null, given: string | undefined) => {
  if (!expected || !given || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(given));
};
const isScreen = (participant: ParticipantInfo) =>
  participant.tracks.some((t) => t.source === TrackSource.SCREEN_SHARE && !t.muted);

/** Encerra de verdade: derruba todos na LiveKit, tira do Redis e guarda no histórico se chegou a ir ao vivo. */
async function endRoom(room: Room, store: RoomStore, client: RoomServiceClient, reason: EndReason, actor?: string) {
  await client.deleteRoom(room.name).catch(() => {});
  await store.remove(room.code);
  if (room.startedAt)
    await store.addEnded({
      code: room.code,
      title: room.title,
      host: room.host,
      hostName: room.hostName,
      hostAvatar: room.hostAvatar,
      category: room.category,
      visibility: room.visibility,
      startedAt: room.startedAt,
      endedAt: Date.now(),
      peakViewers: room.peakViewers,
      reason,
    });
  logEvent('info', reason === 'moderator' ? 'screen.broadcast.moderated' : 'screen.broadcast.ended', {
    room: room.code,
    reason,
    wasLive: room.startedAt !== null,
    durationMs: room.startedAt ? Date.now() - room.startedAt : 0,
    ...(actor ? { actor } : {}),
  });
}

async function execute(user: Identity, input: Input, store: RoomStore, config: Config, options: Options) {
  const now = Date.now();
  if (input.action === 'create') return createRoom(user, input, store, config, now);
  const room = await store.get(input.code!);
  if (room && room.expires < now) await endRoom(room, store, config.client, 'expired');
  // Inexistente, expirada ou bloqueada respondem igual: não revela quais códigos existem.
  if (!room || room.expires < now || room.blocked.includes(user.discordId)) throw new SiteError('ROOM_NOT_FOUND', 404);
  // A LiveKit encerra salas vazias sozinha; o Redis se corrige na próxima ação.
  if (!(await config.client.listRooms([room.name])).length) {
    await endRoom(room, store, config.client, 'closed');
    throw new SiteError('ROOM_NOT_FOUND', 404);
  }
  if (input.action === 'join') return joinRoom(user, input, room, store, config, now);
  if (input.action === 'leave') {
    if (user.discordId !== room.host && !room.admitted.includes(user.discordId))
      throw new SiteError('ROOM_NOT_FOUND', 404);
    await config.client.removeParticipant(room.name, user.discordId).catch(() => {});
    delete room.reservations[user.discordId];
    await store.save(room);
    return { left: true };
  }
  // Moderação: Staff autorizado encerra a transmissão de terceiros (motivo e responsável no log).
  if (input.action === 'end' && room.host !== user.discordId && (await options.isStaff?.())) {
    await endRoom(room, store, config.client, 'moderator', user.discordId);
    if (input.reason) logEvent('info', 'screen.broadcast.moderation_reason', { room: room.code, reason: input.reason });
    return { ended: true };
  }
  if (input.action === 'live') return markLive(user, room, store, config, now);
  return hostAction(user, input, room, store, config);
}

async function createRoom(user: Identity, input: Input, store: RoomStore, config: Config, now: number) {
  const size = input.capacity ?? config.maxCapacity;
  if (size < 2 || size > config.maxCapacity) throw new SiteError('INVALID_INPUT', 400);
  const title = (input.title ?? '').trim();
  if (title.length < 3 || title.length > 80) throw new SiteError('INVALID_INPUT', 400);
  const rooms: Room[] = [];
  const stored = await store.all();
  // Uma única listagem: salas que a LiveKit já encerrou (vazias, servidor reiniciado) saem do Redis e
  // deixam de contar nos limites. Se a listagem falhar, nada é removido e a criação segue o fluxo normal.
  const live = stored.length
    ? await config.client
        .listRooms()
        .then((list) => new Set(list.map((r) => r.name)))
        .catch(() => null)
    : null;
  for (const room of stored) {
    if (room.expires < now) await endRoom(room, store, config.client, 'expired');
    else if (live && !live.has(room.name)) await endRoom(room, store, config.client, 'closed');
    else rooms.push(room);
  }
  // Transmissão já aberta: devolve o código para o usuário voltar a ela ou encerrá-la.
  if (rooms.some((r) => r.host === user.discordId) && MAX_ROOMS_PER_HOST <= 1)
    throw new SiteError('ROOM_ACTIVE_EXISTS', 409);
  if (rooms.length >= MAX_ROOMS) throw new SiteError('RATE_LIMITED', 429);
  let code: string;
  do code = randomBytes(5).toString('hex').toUpperCase();
  while (rooms.some((r) => r.code === code));
  const parsedAvatar = avatar.safeParse(user.image ?? null);
  const room: Room = {
    code,
    name: 'suburbio-' + randomBytes(16).toString('hex'),
    title,
    host: user.discordId,
    createdAt: now,
    expires: now + ROOM_TTL_MS,
    state: 'open',
    capacity: size,
    presenters: [],
    silenced: [],
    blocked: [],
    admitted: [user.discordId],
    reservations: { [user.discordId]: now + RESERVATION_MS },
    description: (input.description ?? '').trim().slice(0, 280),
    category: input.category ?? null,
    visibility: input.visibility ?? 'public',
    inviteKey: input.visibility === 'private' ? randomBytes(16).toString('hex') : null,
    hostName: (user.name || 'Cidadão').slice(0, 64),
    hostAvatar: parsedAvatar.success ? parsedAvatar.data : null,
    startedAt: null,
    hostAwaySince: null,
    peakViewers: 0,
  };
  // A LiveKit também aplica o limite (segunda barreira) e encerra a sala vazia.
  await config.client.createRoom({
    name: room.name,
    emptyTimeout: 300,
    departureTimeout: 60,
    maxParticipants: room.capacity,
    metadata: metadata(room),
  });
  await store.save(room);
  logEvent('info', 'screen.broadcast.created', { room: room.code, visibility: room.visibility });
  return issueToken(user, room, config);
}

async function joinRoom(user: Identity, input: Input, room: Room, store: RoomStore, config: Config, now: number) {
  const id = user.discordId;
  // Privada: só com o convite (ou quem já foi admitido e está voltando). Saber o código não basta.
  if (room.visibility === 'private' && id !== room.host && !room.admitted.includes(id)) {
    if (!sameSecret(room.inviteKey, input.invite)) {
      logEvent('warn', 'screen.room.denied', { room: room.code, reason: 'invite' });
      throw new SiteError('ROOM_INVITE_REQUIRED', 403);
    }
  }
  if (room.state === 'locked' && id !== room.host && !room.admitted.includes(id))
    throw new SiteError('ROOM_LOCKED', 403);
  // Ocupação = conectados na LiveKit + vagas reservadas ainda válidas. Sob o lock da sala,
  // duas entradas simultâneas não ocupam a mesma última vaga.
  const connected = new Set((await config.client.listParticipants(room.name)).map((p) => p.identity));
  for (const [identity, until] of Object.entries(room.reservations))
    if (until < now || connected.has(identity)) delete room.reservations[identity];
  const occupied = new Set([...connected, ...Object.keys(room.reservations)]);
  // Reentrada (reload/queda) usa a mesma identity: não conta duas vezes; a LiveKit troca a conexão antiga.
  if (!occupied.has(id) && occupied.size >= room.capacity) throw new SiteError('ROOM_FULL', 409);
  room.reservations[id] = now + RESERVATION_MS;
  room.admitted = remember(room.admitted, id);
  if (id === room.host) room.hostAwaySince = null;
  await store.save(room);
  return issueToken(user, room, config);
}

/** O transmissor avisa que publicou a tela; o servidor confere na LiveKit antes de marcar AO VIVO. */
async function markLive(user: Identity, room: Room, store: RoomStore, config: Config, now: number) {
  if (room.host !== user.discordId) throw new SiteError('ROOM_HOST_REQUIRED', 403);
  const host = (await config.client.listParticipants(room.name)).find((p) => p.identity === room.host);
  if (!host || !isScreen(host)) throw new SiteError('ROOM_NOT_LIVE', 409);
  if (!room.startedAt) {
    room.startedAt = now;
    logEvent('info', 'screen.broadcast.started', { room: room.code, visibility: room.visibility });
  }
  room.hostAwaySince = null;
  await store.save(room);
  await config.client.updateRoomMetadata(room.name, metadata(room)).catch(() => {});
  return roomView(room, user.discordId);
}

const SCREEN_SOURCES = new Set([TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO]);
async function muteTracks(client: RoomServiceClient, room: Room, participant: ParticipantInfo, all: boolean) {
  for (const track of participant.tracks)
    if (all || SCREEN_SOURCES.has(track.source))
      await client.mutePublishedTrack(room.name, participant.identity, track.sid, true).catch(() => {});
}

async function hostAction(user: Identity, input: Input, room: Room, store: RoomStore, config: Config) {
  const client = config.client;
  if (room.host !== user.discordId) {
    logEvent('warn', 'screen.room.denied', { room: room.code, reason: 'host', operation: input.action });
    throw new SiteError('ROOM_HOST_REQUIRED', 403);
  }
  const target = input.target;
  let participant: ParticipantInfo | undefined;
  if (['kick', 'share', 'silence', 'transfer'].includes(input.action)) {
    participant = (await client.listParticipants(room.name)).find((p) => p.identity === target);
    if (!target || !participant) throw new SiteError('ROOM_NOT_FOUND', 404);
    if (target === room.host) throw new SiteError('INVALID_INPUT', 400);
  }
  switch (input.action) {
    case 'end':
      await endRoom(room, store, client, 'host', user.discordId);
      return { ended: true };
    case 'lock':
      room.state = input.enabled === true ? 'locked' : 'open';
      break;
    case 'kick':
      room.blocked = remember(room.blocked, target!);
      room.admitted = without(room.admitted, target!);
      room.presenters = without(room.presenters, target!);
      delete room.reservations[target!];
      // Tokens emitidos antes deste instante deixam de valer para essa identity.
      await client.removeParticipant(room.name, target!, { revokeTokenTs: BigInt(Math.floor(Date.now() / 1000) + 1) });
      break;
    case 'share':
      room.presenters = input.enabled === true ? remember(room.presenters, target!) : without(room.presenters, target!);
      await client.updateParticipant(room.name, target!, { permission: permissionsFor(room, target!) });
      if (input.enabled !== true) await muteTracks(client, room, participant!, false);
      break;
    case 'silence':
      room.silenced = input.enabled === true ? remember(room.silenced, target!) : without(room.silenced, target!);
      await client.updateParticipant(room.name, target!, { permission: permissionsFor(room, target!) });
      if (input.enabled === true) await muteTracks(client, room, participant!, true);
      break;
    case 'transfer': {
      const previous = room.host;
      room.host = target!;
      room.silenced = without(room.silenced, target!);
      // O anfitrião anterior continua podendo apresentar (não corta uma transmissão em curso).
      room.presenters = remember(without(room.presenters, target!), previous);
      await client.updateParticipant(room.name, target!, { permission: permissionsFor(room, target!) });
      break;
    }
    default:
      throw new SiteError('INVALID_INPUT', 400);
  }
  await store.save(room);
  await client.updateRoomMetadata(room.name, metadata(room));
  return roomView(room, user.discordId);
}

/** Só a URL pública e um JWT de 60s restrito à sala saem do servidor; chave/secret/URL interna nunca. */
async function issueToken(user: Identity, room: Room, config: Config) {
  const token = new AccessToken(config.key, config.secret, {
    identity: user.discordId,
    name: (user.name || 'Cidadão').slice(0, 64),
    metadata: JSON.stringify({ avatar: avatar.safeParse(user.image ?? null).data ?? null }),
    ttl: TOKEN_TTL_SECONDS,
  });
  const permission = permissionsFor(room, user.discordId);
  token.addGrant({
    roomJoin: true,
    room: room.name,
    canSubscribe: true,
    canPublish: permission.canPublish,
    canPublishSources: permission.canPublishSources,
    canPublishData: false,
    canUpdateOwnMetadata: false,
  });
  return { ...roomView(room, user.discordId), url: config.publicUrl, token: await token.toJwt() };
}

// ---------------------------------------------------------------------------------------------
// Central de transmissões: estado real vindo da LiveKit, sem inventar contagens.
// ---------------------------------------------------------------------------------------------
export type BroadcastStatus = 'live' | 'paused' | 'waiting';
export type BroadcastCard = {
  code: string;
  title: string;
  description: string;
  category: Category | null;
  visibility: Visibility;
  host: string;
  hostName: string;
  hostAvatar: string | null;
  status: BroadcastStatus;
  startedAt: number | null;
  viewers: number;
  peakViewers: number;
  hostConnected: boolean;
};
type Snapshot = { room: Room; card: BroadcastCard };

/**
 * Lê a LiveKit uma vez (listRooms) e os participantes só das salas que já foram ao vivo.
 * Quando é a vez desta instância (janela de 15s), também limpa: sala órfã, transmissor ausente além da
 * tolerância, sala que a LiveKit já fechou; e atualiza o pico de espectadores.
 */
async function snapshot(store: RoomStore, config: Config, now = Date.now()): Promise<Snapshot[]> {
  const stored = await store.all();
  if (!stored.length) return [];
  const sweep = await store.sweepDue(SWEEP_EVERY_MS).catch(() => false);
  const liveRooms = new Map((await config.client.listRooms()).map((r) => [r.name, r]));
  const result: Snapshot[] = [];
  for (const room of stored) {
    if (room.expires < now || !liveRooms.has(room.name)) {
      if (sweep)
        await store.exclusive(`room:${room.code}`, () =>
          endRoom(room, store, config.client, room.expires < now ? 'expired' : 'closed'),
        );
      continue;
    }
    if (!room.startedAt) {
      if (sweep && now - room.createdAt > CREATED_GRACE_MS)
        await store.exclusive(`room:${room.code}`, () => endRoom(room, store, config.client, 'closed'));
      else
        result.push({
          room,
          card: card(room, 'waiting', 0, true),
        });
      continue;
    }
    const people = await config.client.listParticipants(room.name);
    const host = people.find((p) => p.identity === room.host);
    const viewers = people.filter((p) => p.identity !== room.host).length;
    const status: BroadcastStatus = host && isScreen(host) ? 'live' : 'paused';
    if (sweep) {
      const away = host ? null : (room.hostAwaySince ?? now);
      if (away !== null && now - away > config.hostGraceMs) {
        await store.exclusive(`room:${room.code}`, () => endRoom(room, store, config.client, 'host_lost'));
        continue;
      }
      if (away !== room.hostAwaySince || viewers > room.peakViewers) {
        await store.exclusive(`room:${room.code}`, async () => {
          const fresh = await store.get(room.code);
          if (!fresh) return;
          fresh.hostAwaySince = host ? null : (fresh.hostAwaySince ?? now);
          fresh.peakViewers = Math.max(fresh.peakViewers, viewers);
          await store.save(fresh);
          room.hostAwaySince = fresh.hostAwaySince;
          room.peakViewers = fresh.peakViewers;
        });
      }
    }
    result.push({ room, card: card(room, status, viewers, !!host) });
  }
  return result;
}
function card(room: Room, status: BroadcastStatus, viewers: number, hostConnected: boolean): BroadcastCard {
  return {
    code: room.code,
    title: room.title,
    description: room.description,
    category: room.category,
    visibility: room.visibility,
    host: room.host,
    hostName: room.hostName,
    hostAvatar: room.hostAvatar,
    status,
    startedAt: room.startedAt,
    viewers,
    peakViewers: Math.max(room.peakViewers, viewers),
    hostConnected,
  };
}

/** /tela: ao vivo públicas (nunca as que só foram criadas), a sua transmissão e as encerradas recentes. */
export async function listBroadcasts(user: Identity, injected?: RoomStore) {
  return guarded('list', async () => {
    const config = liveKitConfig();
    const store = injected ?? defaultStore();
    const rooms = await snapshot(store, config);
    const mine = rooms.find((r) => r.room.host === user.discordId);
    const ended = (await store.ended()).filter((e) => e.visibility === 'public' || e.host === user.discordId);
    return {
      live: rooms
        .filter((r) => r.card.status !== 'waiting' && r.room.visibility === 'public' && r.room.host !== user.discordId)
        .map((r) => r.card)
        .sort((a, b) => b.viewers - a.viewers || (a.startedAt ?? 0) - (b.startedAt ?? 0)),
      mine: mine ? { ...mine.card, ...(mine.room.inviteKey ? { invite: mine.room.inviteKey } : {}) } : null,
      ended: ended.slice(0, 10),
    };
  });
}

/** Admin: todas as abertas (inclusive privadas e aguardando) e o histórico recente. */
export async function moderationOverview(injected?: RoomStore) {
  return guarded('moderation.list', async () => {
    const config = liveKitConfig();
    const store = injected ?? defaultStore();
    return { open: (await snapshot(store, config)).map((r) => r.card), ended: await store.ended() };
  });
}
