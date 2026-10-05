import 'server-only';
import { createClient } from 'redis';
import { serverEnv } from '@/lib/server/env';
import { logEvent } from '@/lib/server/log';

const OPERATION_TIMEOUT_MS = 1000;
const CONNECT_TIMEOUT_MS = 2000;

// Site-local Redis for ephemeral state only (rate limit, locks, screen rooms).
// Keys live under REDIS_KEY_PREFIX and never mix with the API's institutional keys.
export type SiteRedis = {
  key(name: string): string;
  run<T>(operation: string, action: (client: RedisClient) => Promise<T>): Promise<T>;
};
const createSiteClient = (url: string) =>
  createClient({
    url,
    disableOfflineQueue: true,
    socket: {
      connectTimeout: CONNECT_TIMEOUT_MS,
      reconnectStrategy: (retries) => Math.min(100 * 2 ** Math.min(retries, 5), 3000),
    },
  });
type RedisClient = ReturnType<typeof createSiteClient>;
type Connection = { url: string; client: RedisClient; ready: Promise<void> };
export class RedisUnavailable extends Error {}

const shared = globalThis as typeof globalThis & { suburbioSiteRedis?: Connection };

function connection(url: string): Connection {
  if (shared.suburbioSiteRedis?.url === url) return shared.suburbioSiteRedis;
  const client = createSiteClient(url);
  // Error events carry the URL; they are classified per operation instead of being logged raw.
  client.on('error', () => {});
  const ready = client.connect().then(() => undefined);
  ready.catch(() => {});
  shared.suburbioSiteRedis = { url, client, ready };
  return { url, client, ready };
}

async function withTimeout<T>(promise: Promise<T>, ms: number) {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new RedisUnavailable('timeout')), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Returns null when Redis is not configured (single-instance mode). */
export function siteRedis(): SiteRedis | null {
  const env = serverEnv();
  if (!env.REDIS_URL) return null;
  const prefix = env.REDIS_KEY_PREFIX;
  const url = env.REDIS_URL;
  return {
    key: (name) => prefix + name,
    async run(operation, action) {
      const started = performance.now();
      try {
        const current = connection(url);
        await withTimeout(current.ready, CONNECT_TIMEOUT_MS);
        if (!current.client.isReady) throw new RedisUnavailable('not ready');
        return await withTimeout(action(current.client), OPERATION_TIMEOUT_MS);
      } catch (error) {
        logEvent('warn', 'redis.unavailable', {
          service: 'redis',
          operation,
          durationMs: Math.round(performance.now() - started),
        });
        throw error instanceof RedisUnavailable ? error : new RedisUnavailable('failed');
      }
    },
  };
}

const RELEASE = "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0";

/** Distributed lock with owner token; throws RedisUnavailable if the lock cannot be acquired in time. */
export async function withRedisLock<T>(
  redis: SiteRedis,
  name: string,
  ttlMs: number,
  task: () => Promise<T>,
): Promise<T> {
  const key = redis.key(`lock:${name}`);
  const owner = crypto.randomUUID();
  const deadline = Date.now() + 3000;
  while (!(await redis.run('lock.acquire', (c) => c.set(key, owner, { NX: true, PX: ttlMs })))) {
    if (Date.now() > deadline) throw new RedisUnavailable('lock busy');
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 50));
  }
  try {
    return await task();
  } finally {
    await redis.run('lock.release', (c) => c.eval(RELEASE, { keys: [key], arguments: [owner] })).catch(() => {});
  }
}
