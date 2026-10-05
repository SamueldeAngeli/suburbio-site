import { beforeEach, it, expect, vi } from 'vitest';
import { config, discordId, playerId, operationId } from './fixtures';
const mocks = vi.hoisted(() => ({ session: vi.fn(), cancel: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ currentSession: mocks.session }));
vi.mock('@/lib/server/env', async (original) => ({ ...(await original<object>()), serverEnv: () => config }));
vi.mock('@/lib/api/client', () => ({
  SuburbioApiClient: class {
    cancelOrder = mocks.cancel;
  },
}));
import { POST } from '@/app/api/vip/orders/cancel/route';
const request = (extra: object = {}, origin = config.AUTH_URL!) =>
  new Request('http://localhost/api/vip/orders/cancel', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json', 'x-suburbio-intent': 'order.cancel' },
    body: JSON.stringify({ id: playerId, idempotencyKey: operationId, ...extra }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ user: { discordId } });
  mocks.cancel.mockResolvedValue({ data: {} });
});
it('cancelamento exige sessão', async () => {
  mocks.session.mockResolvedValue(null);
  expect((await POST(request())).status).toBe(401);
  expect(mocks.cancel).not.toHaveBeenCalled();
});
it('cancelamento rejeita CSRF', async () => {
  expect((await POST(request({}, 'https://evil.example'))).status).toBe(403);
  expect(mocks.cancel).not.toHaveBeenCalled();
});
it('cancelamento rejeita identidade fornecida pelo browser', async () => {
  expect((await POST(request({ customerDiscordId: discordId }))).status).toBe(400);
  expect(mocks.cancel).not.toHaveBeenCalled();
});
it('cancelamento usa identidade da sessão e mantém a chave de retry', async () => {
  expect((await POST(request())).status).toBe(200);
  expect(mocks.cancel).toHaveBeenCalledWith(discordId, playerId, operationId);
});
