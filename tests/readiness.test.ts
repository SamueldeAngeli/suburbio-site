import { it, expect, vi, beforeEach } from 'vitest';
const m = vi.hoisted(() => ({ health: vi.fn(), redis: vi.fn() }));
vi.mock('@/lib/api/client', () => ({
  SuburbioApiClient: class {
    publicHealth = m.health;
  },
}));
vi.mock('@/lib/server/redis', () => ({ siteRedis: m.redis }));
import { readiness } from '@/lib/server/readiness';

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv('SUBURBIO_API_ENABLED', 'true');
  vi.stubEnv('SUBURBIO_API_URL', 'http://127.0.0.1:3000');
  vi.stubEnv('SITE_SERVICE_SECRET', 'x'.repeat(32));
  m.redis.mockReturnValue(null);
});

it('ready when API answers ok and Redis is not configured', async () => {
  m.health.mockResolvedValue({ data: { status: 'ok' } });
  expect(await readiness()).toEqual({ ready: true, checks: { config: 'ok', api: 'up', redis: 'disabled' } });
});

it('API unavailable makes the site not ready', async () => {
  m.health.mockRejectedValue(new Error('offline'));
  expect(await readiness()).toMatchObject({ ready: false, checks: { api: 'down' } });
});

it('Redis down is reported but does not remove the site from rotation', async () => {
  m.health.mockResolvedValue({ data: { status: 'ok' } });
  m.redis.mockReturnValue({
    run: async () => {
      throw new Error('down');
    },
  });
  expect(await readiness()).toEqual({ ready: true, checks: { config: 'ok', api: 'up', redis: 'down' } });
});

it('invalid configuration is not ready and does not echo values', async () => {
  vi.stubEnv('SITE_SERVICE_SECRET', 'short');
  const result = await readiness();
  expect(result).toEqual({ ready: false, checks: { config: 'invalid', api: 'disabled', redis: 'disabled' } });
  expect(JSON.stringify(result)).not.toContain('short');
});
