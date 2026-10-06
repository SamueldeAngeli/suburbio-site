import { it, expect, vi, beforeEach } from 'vitest';
const m = vi.hoisted(() => ({ health: vi.fn(), redis: vi.fn(), livekit: vi.fn() }));
vi.mock('@/lib/api/client', () => ({
  SuburbioApiClient: class {
    publicHealth = m.health;
  },
}));
vi.mock('@/lib/server/redis', () => ({ siteRedis: m.redis }));
vi.mock('@/lib/screen/rooms', () => ({ liveKitReachable: m.livekit }));
import { readiness } from '@/lib/server/readiness';

const redisUp = { run: async () => 'PONG' };
const redisDown = {
  run: async () => {
    throw new Error('down');
  },
};
beforeEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.stubEnv('SUBURBIO_API_ENABLED', 'true');
  vi.stubEnv('SUBURBIO_API_URL', 'http://127.0.0.1:3000');
  vi.stubEnv('SITE_SERVICE_SECRET', 'x'.repeat(32));
  m.redis.mockReturnValue(null);
  m.livekit.mockResolvedValue('up');
});
function enableScreen() {
  vi.stubEnv('LIVEKIT_ENABLED', 'true');
  vi.stubEnv('LIVEKIT_INTERNAL_URL', 'http://127.0.0.1:7880');
  vi.stubEnv('LIVEKIT_PUBLIC_URL', 'ws://127.0.0.1:7880');
  vi.stubEnv('LIVEKIT_API_KEY', 'key');
  vi.stubEnv('LIVEKIT_API_SECRET', 'dev-secret');
  vi.stubEnv('REDIS_URL', 'redis://127.0.0.1:6379');
}

it('ready when API answers ok and Redis is not configured', async () => {
  m.health.mockResolvedValue({ data: { status: 'ok' } });
  expect(await readiness()).toEqual({
    ready: true,
    checks: { config: 'ok', api: 'up', redis: 'disabled', livekit: 'disabled' },
  });
  expect(m.livekit).not.toHaveBeenCalled();
});

it('API unavailable makes the site not ready', async () => {
  m.health.mockRejectedValue(new Error('offline'));
  expect(await readiness()).toMatchObject({ ready: false, checks: { api: 'down' } });
});

it('sem transmissão, Redis fora é reportado mas não tira o site de rotação', async () => {
  m.health.mockResolvedValue({ data: { status: 'ok' } });
  m.redis.mockReturnValue(redisDown);
  expect(await readiness()).toEqual({
    ready: true,
    checks: { config: 'ok', api: 'up', redis: 'down', livekit: 'disabled' },
  });
});

it('com transmissão ligada, Redis fora deixa o site não pronto (dependência obrigatória)', async () => {
  enableScreen();
  m.health.mockResolvedValue({ data: { status: 'ok' } });
  m.redis.mockReturnValue(redisDown);
  expect(await readiness()).toMatchObject({ ready: false, checks: { redis: 'down', livekit: 'up' } });
});

it('com transmissão ligada, LiveKit inalcançável deixa o site não pronto', async () => {
  enableScreen();
  m.health.mockResolvedValue({ data: { status: 'ok' } });
  m.redis.mockReturnValue(redisUp);
  m.livekit.mockResolvedValue('down');
  expect(await readiness()).toMatchObject({ ready: false, checks: { redis: 'up', livekit: 'down' } });
});

it('com transmissão ligada e dependências no ar, o site fica pronto', async () => {
  enableScreen();
  m.health.mockResolvedValue({ data: { status: 'ok' } });
  m.redis.mockReturnValue(redisUp);
  expect(await readiness()).toEqual({
    ready: true,
    checks: { config: 'ok', api: 'up', redis: 'up', livekit: 'up' },
  });
});

it('invalid configuration is not ready and does not echo values', async () => {
  vi.stubEnv('SITE_SERVICE_SECRET', 'short');
  const result = await readiness();
  expect(result).toEqual({
    ready: false,
    checks: { config: 'invalid', api: 'disabled', redis: 'disabled', livekit: 'disabled' },
  });
  expect(JSON.stringify(result)).not.toContain('short');
});
