import 'server-only';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { AccessToken, RoomServiceClient, TrackSource, type ParticipantInfo } from 'livekit-server-sdk';
import { SiteError } from '@/lib/api/errors';
import { serverEnv } from '@/lib/server/env';
import { logEvent } from '@/lib/server/log';
import { RedisUnavailable, siteRedis, withRedisLock, type SiteRedis } from '@/lib/server/redis';

type Identity = { discordId: string; name?: string | null; image?: string | null };
export type RoomAction = 'create' | 'join' | 'leave' | 'lock' | 'kick' | 'share' | 'silence' | 'transfer' | 'end';
export type RoomRole = 'host' | 'presenter' | 'participant';
type Input = { action: RoomAction; code?: string; target?: string; enabled?: boolean; capacity?: number };

const snowflake = z.string().regex(/^\d{17,20}$/);
const ids = z.array(snowflake).max(200);
// Estado autoritativo da sala (Redis). Validado na leitura: registro corrompido é tratado como inexistente.
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
  })
  .strict();
export type Room = z.infer<typeof roomSchema>;

const ROOM_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_ROOMS = 100;
const MAX_ROOMS_PER_HOST = 2;
// O token só precisa valer na conexão; conectado, a LiveKit renova a credencial sozinha.
const TOKEN_TTL_SECONDS = 60;
// Vaga reservada entre a emissão do token e a conexão aparecer na LiveKit.
const RESERVATION_MS = 90_000;
const LOCK_TTL_MS = 10_000;
const MAX_HISTORY = 200;
const PRESENTER_SOURCES = [TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO, TrackSource.MICROPHONE];
const PARTICIPANT_SOURCES = [TrackSource.MICROPHONE];

export interface RoomStore {
  exclusive<T>(scope: string, task: () => Promise<T>): Promise<T>;
  all(): Promise<Room[]>;
  get(code: string): Promise<Room | undefined>;
  save(room: Room): Promise<void>;
  remove(code: string): Promise<void>;
}

const parseRoom = (value: string | null | undefined) => {
  if (!value) return undefined;
  try {
    const parsed = roomSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
};

/** Salas no Redis do site: sobrevivem a restart e são compartilhadas entre instâncias. */
export class RedisRoomStore implements RoomStore {
  constructor(private redis: SiteRedis) {}
  private get key() {
    return this.redis.key('livekit:rooms');
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

export async function roomAction(user: Identity, input: Input, injected?: RoomStore) {
  const started = performance.now();
  try {
    const config = liveKitConfig();
    const store = injected ?? defaultStore();
    if (input.action !== 'create' && !input.code) throw new SiteError('INVALID_INPUT', 400);
    const scope = input.action === 'create' ? 'rooms:create' : `room:${input.code}`;
    return await store.exclusive(scope, () => execute(user, input, store, config));
  } catch (error) {
    if (error instanceof SiteError) throw error;
    logEvent(error instanceof RedisUnavailable ? 'warn' : 'error', 'screen.room.unavailable', {
      service: error instanceof RedisUnavailable ? 'redis' : 'livekit',
      operation: input.action,
      durationMs: Math.round(performance.now() - started),
    });
    throw new SiteError('ROOM_UNAVAILABLE');
  }
}

function roleOf(room: Room, identity: string): RoomRole {
  if (identity === room.host) return 'host';
  return room.presenters.includes(identity) ? 'presenter' : 'participant';
}
/** Permissões mínimas: tela só para anfitrião/apresentador; microfone opcional; silenciado não publica. */
function permissionsFor(room: Room, identity: string) {
  const silenced = room.silenced.includes(identity);
  const sources = silenced ? [] : roleOf(room, identity) === 'participant' ? PARTICIPANT_SOURCES : PRESENTER_SOURCES;
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
    locked: room.state === 'locked',
    capacity: room.capacity,
    presenters: room.presenters,
    silenced: room.silenced,
  });
const roomView = (room: Room, identity: string) => ({
  code: room.code,
  title: room.title,
  host: room.host,
  locked: room.state === 'locked',
  capacity: room.capacity,
  role: roleOf(room, identity),
});

async function execute(user: Identity, input: Input, store: RoomStore, config: Config) {
  const now = Date.now();
  if (input.action === 'create') return createRoom(user, input.capacity, store, config, now);
  const room = await store.get(input.code!);
  if (room && room.expires < now) {
    await config.client.deleteRoom(room.name).catch(() => {});
    await store.remove(room.code);
  }
  // Inexistente, expirada ou bloqueada respondem igual: não revela quais códigos existem.
  if (!room || room.expires < now || room.blocked.includes(user.discordId)) throw new SiteError('ROOM_NOT_FOUND', 404);
  // A LiveKit encerra salas vazias sozinha; o Redis se corrige na próxima ação.
  if (!(await config.client.listRooms([room.name])).length) {
    await store.remove(room.code);
    throw new SiteError('ROOM_NOT_FOUND', 404);
  }
  if (input.action === 'join') return joinRoom(user, room, store, config, now);
  if (input.action === 'leave') {
    if (user.discordId !== room.host && !room.admitted.includes(user.discordId))
      throw new SiteError('ROOM_NOT_FOUND', 404);
    await config.client.removeParticipant(room.name, user.discordId).catch(() => {});
    delete room.reservations[user.discordId];
    await store.save(room);
    return { left: true };
  }
  return hostAction(user, input, room, store, config.client);
}

async function createRoom(user: Identity, capacity: number | undefined, store: RoomStore, config: Config, now: number) {
  const size = capacity ?? config.maxCapacity;
  if (size < 2 || size > config.maxCapacity) throw new SiteError('INVALID_INPUT', 400);
  const rooms: Room[] = [];
  for (const room of await store.all()) {
    if (room.expires >= now) rooms.push(room);
    else {
      await config.client.deleteRoom(room.name).catch(() => {});
      await store.remove(room.code);
    }
  }
  if (rooms.length >= MAX_ROOMS || rooms.filter((r) => r.host === user.discordId).length >= MAX_ROOMS_PER_HOST)
    throw new SiteError('RATE_LIMITED', 429);
  let code: string;
  do code = randomBytes(5).toString('hex').toUpperCase();
  while (rooms.some((r) => r.code === code));
  const room: Room = {
    code,
    name: 'suburbio-' + randomBytes(16).toString('hex'),
    title: `Sala de ${(user.name || 'Cidadão').slice(0, 64)}`,
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
  return issueToken(user, room, config);
}

async function joinRoom(user: Identity, room: Room, store: RoomStore, config: Config, now: number) {
  const id = user.discordId;
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
  await store.save(room);
  return issueToken(user, room, config);
}

const SCREEN_SOURCES = new Set([TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO]);
async function muteTracks(client: RoomServiceClient, room: Room, participant: ParticipantInfo, all: boolean) {
  for (const track of participant.tracks)
    if (all || SCREEN_SOURCES.has(track.source))
      await client.mutePublishedTrack(room.name, participant.identity, track.sid, true).catch(() => {});
}

async function hostAction(user: Identity, input: Input, room: Room, store: RoomStore, client: RoomServiceClient) {
  if (room.host !== user.discordId) throw new SiteError('ROOM_HOST_REQUIRED', 403);
  const target = input.target;
  let participant: ParticipantInfo | undefined;
  if (['kick', 'share', 'silence', 'transfer'].includes(input.action)) {
    participant = (await client.listParticipants(room.name)).find((p) => p.identity === target);
    if (!target || !participant) throw new SiteError('ROOM_NOT_FOUND', 404);
    if (target === room.host) throw new SiteError('INVALID_INPUT', 400);
  }
  switch (input.action) {
    case 'end':
      await client.deleteRoom(room.name);
      await store.remove(room.code);
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
    metadata: JSON.stringify({ avatar: user.image ?? null }),
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
