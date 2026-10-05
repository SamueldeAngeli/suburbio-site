import { it, expect, vi, beforeEach } from 'vitest';
const m = vi.hoisted(() => ({ guard: vi.fn(), save: vi.fn(), payout: vi.fn(), origin: vi.fn() }));
vi.mock('@/lib/permissions/guards', () => ({ requireAdmin: m.guard }));
vi.mock('@/lib/api/client', () => ({
  SuburbioApiClient: class {
    saveAffiliate = m.save;
    affiliatePayout = m.payout;
  },
}));
vi.mock('@/lib/server/env', () => ({ serverEnv: () => ({ AUTH_URL: 'http://localhost' }) }));
vi.mock('@/lib/server/security', () => ({
  assertOrigin: m.origin,
  readJson: (r: Request) => r.json(),
  limiter: { consume: vi.fn() },
}));
import { POST } from '@/app/api/admin/affiliates/route';
import { SiteError } from '@/lib/api/errors';
const input = {
  action: 'save',
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
  data: {
    affiliate: {
      discordId: '222222222222222222',
      name: 'Teste',
      couponName: 'Cupom teste',
      code: 'TESTE',
      discountPercent: 5,
      commissionPercent: 8,
      holdDays: 14,
      status: 'ACTIVE',
      type: 'PARTNER',
      expiresAt: null,
      notes: '',
    },
    reason: 'Teste de cadastro',
    confirm: true,
  },
};
const request = (body: unknown = input, intent = 'affiliate.write') =>
  new Request('http://localhost/api/admin/affiliates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-suburbio-intent': intent },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  m.guard.mockResolvedValue({ discordId: '123456789012345678', readOnly: false });
  m.save.mockResolvedValue({ data: { affiliate: { id: 'test' } } });
});
it('save uses human identity from guard only', async () => {
  expect((await POST(request())).status).toBe(200);
  expect(m.guard).toHaveBeenCalledWith('AFFILIATES_MANAGE');
  expect(m.save.mock.calls[0][0]).toBe('123456789012345678');
  expect(m.origin).toHaveBeenCalled();
});
it('browser actor injection rejected', async () => {
  expect((await POST(request({ ...input, actorDiscordId: '999999999999999999' }))).status).toBe(400);
  expect(m.save).not.toHaveBeenCalled();
});
it('missing explicit confirmation rejected', async () =>
  expect((await POST(request({ ...input, data: { ...input.data, confirm: false } }))).status).toBe(400));
it('missing CSRF intent rejected', async () => expect((await POST(request(input, 'other'))).status).toBe(400));
it('read only admin cannot mutate', async () => {
  m.guard.mockResolvedValue({ discordId: '123456789012345678', readOnly: true });
  expect((await POST(request())).status).toBe(503);
  expect(m.save).not.toHaveBeenCalled();
});
it('denied capability does not reach API write', async () => {
  m.guard.mockRejectedValue(new SiteError('ADMIN_CAPABILITY_REQUIRED', 403));
  expect((await POST(request())).status).toBe(403);
  expect(m.save).not.toHaveBeenCalled();
});
it('payout requires separate financial capability', async () => {
  m.payout.mockResolvedValue({ data: { payout: { id: 'test' } } });
  const body = {
    action: 'payout',
    id: '11111111-1111-4111-8111-111111111111',
    idempotencyKey: '22222222-2222-4222-8222-222222222222',
    data: {
      orderIds: ['33333333-3333-4333-8333-333333333333'],
      expectedAmountMinor: '760',
      note: 'Pagamento comprovado',
      confirm: true,
    },
  };
  expect((await POST(request(body))).status).toBe(200);
  expect(m.guard).toHaveBeenCalledWith('AFFILIATES_PAYOUT_MANAGE');
});
