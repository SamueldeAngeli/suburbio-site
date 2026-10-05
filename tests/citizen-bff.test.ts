import { it, expect, vi, beforeEach } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), balance: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ currentSession: mocks.session }));
vi.mock('@/lib/api/client', () => ({
  SuburbioApiClient: class {
    citizenBalance = mocks.balance;
  },
}));
import { GET } from '@/app/api/me/crypto/route';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ user: { discordId: '123456789012345678' } });
  mocks.balance.mockResolvedValue({ data: { balance: '1250', currency: 'CRYPTO', asOf: '2026-10-04T00:00:00Z' } });
});
it('BFF usa somente identidade da sessão e não cacheia', async () => {
  const response = await GET(new Request('http://localhost/api/me/crypto'));
  expect(response.status).toBe(200);
  expect(mocks.balance).toHaveBeenCalledWith('123456789012345678');
  expect(response.headers.get('cache-control')).toContain('no-store');
});
it('BFF não autenticado recebe 401', async () => {
  mocks.session.mockResolvedValue(null);
  expect((await GET(new Request('http://localhost/api/me/crypto'))).status).toBe(401);
  expect(mocks.balance).not.toHaveBeenCalled();
});
it('BFF rejeita consulta de outro player e saldo fornecido', async () => {
  for (const query of ['?playerId=other', '?customerDiscordId=other', '?balance=9999'])
    expect((await GET(new Request('http://localhost/api/me/crypto' + query))).status).toBe(400);
  expect(mocks.balance).not.toHaveBeenCalled();
});
