import 'server-only';
import { SuburbioApiClient } from '@/lib/api/client';
import { serverEnv } from '@/lib/server/env';
import { siteRedis } from '@/lib/server/redis';

type Check = 'up' | 'down' | 'disabled';
export type Readiness = { ready: boolean; checks: { config: 'ok' | 'invalid'; api: Check; redis: Check } };

/** Readiness: config valid, API reachable when enabled, Redis reachable when configured. */
export async function readiness(): Promise<Readiness> {
  let env;
  try {
    env = serverEnv();
  } catch {
    return { ready: false, checks: { config: 'invalid', api: 'disabled', redis: 'disabled' } };
  }
  const [api, redis] = await Promise.all([
    env.SUBURBIO_API_ENABLED
      ? new SuburbioApiClient(env)
          .publicHealth()
          .then((r): Check => (r.data.status === 'ok' ? 'up' : 'down'))
          .catch((): Check => 'down')
      : Promise.resolve<Check>('disabled'),
    (async (): Promise<Check> => {
      const client = siteRedis();
      if (!client) return 'disabled';
      return client
        .run('ready.ping', (c) => c.ping())
        .then((): Check => 'up')
        .catch((): Check => 'down');
    })(),
  ]);
  // Redis down is degraded (local fallback exists), not a reason to pull the site from rotation.
  return { ready: api !== 'down', checks: { config: 'ok', api, redis } };
}
