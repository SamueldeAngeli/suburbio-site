import 'server-only';
import { SuburbioApiClient } from '@/lib/api/client';
import { serverEnv } from '@/lib/server/env';
import { siteRedis } from '@/lib/server/redis';
import { liveKitReachable } from '@/lib/screen/rooms';

type Check = 'up' | 'down' | 'disabled';
export type Readiness = {
  ready: boolean;
  checks: { config: 'ok' | 'invalid'; api: Check; redis: Check; livekit: Check };
};

/**
 * Readiness: dependências obrigatórias das funções habilitadas.
 * - API, quando SUBURBIO_API_ENABLED.
 * - Redis e LiveKit, quando LIVEKIT_ENABLED (salas não existem sem eles).
 * Sem transmissão, Redis fora é degradação (há fallback local de rate limit).
 * Falha de uma transmissão individual nunca entra aqui: só a alcançabilidade dos serviços.
 */
export async function readiness(): Promise<Readiness> {
  let env;
  try {
    env = serverEnv();
  } catch {
    return { ready: false, checks: { config: 'invalid', api: 'disabled', redis: 'disabled', livekit: 'disabled' } };
  }
  const [api, redis, livekit] = await Promise.all([
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
    env.LIVEKIT_ENABLED ? liveKitReachable() : Promise.resolve<Check>('disabled'),
  ]);
  const screenReady = !env.LIVEKIT_ENABLED || (redis === 'up' && livekit === 'up');
  return { ready: api !== 'down' && screenReady, checks: { config: 'ok', api, redis, livekit } };
}
