import 'server-only';
import { randomBytes } from 'node:crypto';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { SiteError } from '@/lib/api/errors';
import { serverEnv } from '@/lib/server/env';
import { logEvent } from '@/lib/server/log';
import { RedisUnavailable, siteRedis, withRedisLock, type SiteRedis } from '@/lib/server/redis';

type Identity = { discordId: string; name?: string | null; image?: string | null };
export type RoomAction = 'create' | 'join' | 'lock' | 'kick' | 'share' | 'transfer' | 'end' | 'leave';
type Input = { action: RoomAction; code?: string; target?: string; enabled?: boolean };
export type Room = {
  code: string;
  name: string;
  host: string;
  locked: boolean;
  blocked: string[];
  sharingBlocked: string[];
  members: string[];
  expires: number;
};

const ROOM_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_ROOMS = 100;
const MAX_ROOMS_PER_HOST = 2;
const TOKEN_TTL_SECONDS = 60;
const LOCK_TTL_MS = 10_000;
const VIEWER_PERMISSION = { canSubscribe: true, canPublishData: false, canUpdateMetadata: false };

/** Room registry. Redis when configured (survives restarts, shared by instances); memory otherwise. */
export interface RoomStore {
  exclusive<T>(task: () => Promise<T>): Promise<T>;
  all(): Promise<Room[]>;
  save(room: Room): Promise<void>;
  remove(code: string): Promise<void>;
}

const memory = globalThis as typeof globalThis & {
  suburbioRooms?: Map<string, Room>;
  suburbioRoomLock?: Promise<unknown>;
};
export class MemoryRoomStore implements RoomStore {
  private rooms = (memory.suburbioRooms ??= new Map<string, Room>());
  exclusive<T>(task: () => Promise<T>) {
    const job = (memory.suburbioRoomLock ?? Promise.resolve()).catch(() => {}).then(task);
    memory.suburbioRoomLock = job;
    return job;
  }
  async all() {
    return [...this.rooms.values()].map((room) => structuredClone(room));
  }
  async save(room: Room) {
    this.rooms.set(room.code, structuredClone(room));
  }
  async remove(code: string) {
    this.rooms.delete(code);
  }
}

export class RedisRoomStore implements RoomStore {
  constructor(private redis: SiteRedis) {}
  private get key() {
    return this.redis.key('livekit:rooms');
  }
  exclusive<T>(task: () => Promise<T>) {
    return withRedisLock(this.redis, 'livekit:rooms', LOCK_TTL_MS, task);
  }
  async all() {
    const values = await this.redis.run('rooms.all', (c) => c.hVals(this.key));
    return values.map((value) => JSON.parse(value) as Room);
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
    client: new RoomServiceClient(internal, env.LIVEKIT_API_KEY!, env.LIVEKIT_API_SECRET!),
  };
}

function defaultStore(): RoomStore {
  const redis = siteRedis();
  return redis ? new RedisRoomStore(redis) : new MemoryRoomStore();
}

export async function roomAction(user: Identity, input: Input, store: RoomStore = defaultStore()) {
  const config = liveKitConfig();
  const started = performance.now();
  try {
    return await store.exclusive(() => execute(user, input, store, config));
  } catch (error) {
    if (error instanceof RedisUnavailable) {
      logEvent('warn', 'screen.room.unavailable', {
        service: 'livekit',
        operation: input.action,
        durationMs: Math.round(performance.now() - started),
      });
      throw new SiteError('ROOM_UNAVAILABLE');
    }
    if (!(error instanceof SiteError)) {
      logEvent('error', 'screen.room.failed', {
        service: 'livekit',
        operation: input.action,
        durationMs: Math.round(performance.now() - started),
      });
      throw new SiteError('ROOM_UNAVAILABLE');
    }
    throw error;
  }
}

type Config = ReturnType<typeof liveKitConfig>;

async function sweepExpired(rooms: Room[], store: RoomStore, client: RoomServiceClient, now: number) {
  const active: Room[] = [];
  for (const room of rooms) {
    if (room.expires >= now) {
      active.push(room);
      continue;
    }
    await client.deleteRoom(room.name).catch(() => {});
    await store.remove(room.code);
  }
  return active;
}

async function execute(user: Identity, input: Input, store: RoomStore, config: Config) {
  const { client } = config;
  const rooms = await sweepExpired(await store.all(), store, client, Date.now());
  if (input.action === 'create') return issueToken(user, await createRoom(user, rooms, store, client), config);

  const room = rooms.find((r) => r.code === input.code);
  if (!room || room.blocked.includes(user.discordId)) throw new SiteError('ROOM_NOT_FOUND', 404);
  if (!(await client.listRooms([room.name])).length) {
    await store.remove(room.code);
    throw new SiteError('ROOM_NOT_FOUND', 404);
  }
  if (input.action === 'join') {
    if (room.locked && room.host !== user.discordId && !room.members.includes(user.discordId))
      throw new SiteError('ROOM_LOCKED', 403);
    if (!room.members.includes(user.discordId)) room.members.push(user.discordId);
    await store.save(room);
    return issueToken(user, room, config);
  }
  if (input.action === 'leave') {
    if (!room.members.includes(user.discordId)) throw new SiteError('ROOM_NOT_FOUND', 404);
    await client.removeParticipant(room.name, user.discordId).catch(() => {});
    room.members = room.members.filter((id) => id !== user.discordId);
    await store.save(room);
    return { left: true };
  }
  return hostAction(user, input, room, store, client);
}

async function createRoom(user: Identity, rooms: Room[], store: RoomStore, client: RoomServiceClient) {
  if (rooms.length >= MAX_ROOMS || rooms.filter((r) => r.host === user.discordId).length >= MAX_ROOMS_PER_HOST)
    throw new SiteError('RATE_LIMITED', 429);
  let code: string;
  do code = randomBytes(5).toString('hex').toUpperCase();
  while (rooms.some((r) => r.code === code));
  const room: Room = {
    code,
    name: 'suburbio-' + randomBytes(16).toString('hex'),
    host: user.discordId,
    locked: false,
    blocked: [],
    sharingBlocked: [],
    members: [user.discordId],
    expires: Date.now() + ROOM_TTL_MS,
  };
  await client.createRoom({
    name: room.name,
    emptyTimeout: 120,
    departureTimeout: 60,
    maxParticipants: 12,
    metadata: JSON.stringify({ host: room.host, locked: false }),
  });
  await store.save(room);
  return room;
}

async function hostAction(user: Identity, input: Input, room: Room, store: RoomStore, client: RoomServiceClient) {
  if (room.host !== user.discordId) throw new SiteError('ROOM_HOST_REQUIRED', 403);
  const target = input.target;
  if (['kick', 'share', 'transfer'].includes(input.action)) {
    const participants = await client.listParticipants(room.name);
    if (!target || !participants.some((p) => p.identity === target)) throw new SiteError('ROOM_NOT_FOUND', 404);
  }
  switch (input.action) {
    case 'end':
      await client.deleteRoom(room.name);
      await store.remove(room.code);
      return { ended: true };
    case 'lock':
      room.locked = input.enabled === true;
      break;
    case 'kick':
      if (target === room.host) throw new SiteError('INVALID_INPUT', 400);
      room.blocked.push(target!);
      room.members = room.members.filter((id) => id !== target);
      await client.removeParticipant(room.name, target!, { revokeTokenTs: BigInt(Math.floor(Date.now() / 1000) + 1) });
      break;
    case 'share':
      await client.updateParticipant(room.name, target!, {
        permission: { ...VIEWER_PERMISSION, canPublish: input.enabled === true },
      });
      room.sharingBlocked = room.sharingBlocked.filter((id) => id !== target);
      if (!input.enabled) room.sharingBlocked.push(target!);
      break;
    case 'transfer':
      await client.updateParticipant(room.name, target!, { permission: { ...VIEWER_PERMISSION, canPublish: true } });
      room.sharingBlocked = room.sharingBlocked.filter((id) => id !== target);
      room.host = target!;
      break;
    default:
      throw new SiteError('INVALID_INPUT', 400);
  }
  await store.save(room);
  await client.updateRoomMetadata(room.name, JSON.stringify({ host: room.host, locked: room.locked }));
  return { code: room.code, host: room.host, locked: room.locked };
}

/** Only the public WSS URL and a 60s room-scoped JWT leave the server; API key/secret never do. */
async function issueToken(user: Identity, room: Room, config: Config) {
  const token = new AccessToken(config.key, config.secret, {
    identity: user.discordId,
    name: user.name ?? 'Cidadão',
    metadata: JSON.stringify({ avatar: user.image ?? null }),
    ttl: TOKEN_TTL_SECONDS,
  });
  token.addGrant({
    roomJoin: true,
    room: room.name,
    canPublish: !room.sharingBlocked.includes(user.discordId),
    canSubscribe: true,
    canPublishData: false,
    canUpdateOwnMetadata: false,
  });
  return { code: room.code, host: room.host, locked: room.locked, url: config.publicUrl, token: await token.toJwt() };
}
