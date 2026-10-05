import { it, expect, vi, beforeEach } from 'vitest';
const m = vi.hoisted(() => ({ session: vi.fn(), affiliate: vi.fn(), admin: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ currentSession: m.session }));
vi.mock('@/lib/api/client', () => ({
  SuburbioApiClient: class {
    affiliateAccess = m.affiliate;
  },
}));
vi.mock('@/lib/api/modules/accounts', () => ({
  AccountService: class {
    resolve = m.admin;
  },
}));
import { GET } from '@/app/api/me/access/route';
beforeEach(() => {
  vi.clearAllMocks();
  m.session.mockResolvedValue({ user: { discordId: '123456789012345678' } });
  m.affiliate.mockResolvedValue({ data: { affiliate: false } });
  m.admin.mockRejectedValue(Error('denied'));
});
it('common user gets no privileged menu links', async () =>
  expect(await (await GET(new Request('http://localhost/api/me/access'))).json()).toEqual({
    affiliate: false,
    admin: false,
  }));
it('API independently confirms both states', async () => {
  m.affiliate.mockResolvedValue({ data: { affiliate: true } });
  m.admin.mockResolvedValue({ admin: { status: 'active', capabilities: ['AFFILIATES_READ'], fullAccess: false } });
  const r = await GET(new Request('http://localhost/api/me/access'));
  expect(await r.json()).toEqual({ affiliate: true, admin: true });
  expect(r.headers.get('cache-control')).toContain('no-store');
  expect(m.affiliate).toHaveBeenCalledWith('123456789012345678');
});
it('API failures fail closed without hiding valid independent access', async () => {
  m.affiliate.mockRejectedValue(Error('offline'));
  expect(await (await GET(new Request('http://localhost/api/me/access'))).json()).toEqual({
    affiliate: false,
    admin: false,
  });
});
it('session required', async () => {
  m.session.mockResolvedValue(null);
  expect((await GET(new Request('http://localhost/api/me/access'))).status).toBe(401);
});
it('client-supplied roles or identity rejected', async () => {
  expect((await GET(new Request('http://localhost/api/me/access?admin=true'))).status).toBe(400);
  expect(m.admin).not.toHaveBeenCalled();
});

import { couponSchema } from '@/lib/api/coupon-contracts';
it('catalog accepts an affiliate coupon with zero discount independently of commission', () => {
  const coupon = {
    id: '11111111-1111-4111-8111-111111111111',
    revision: 1,
    createdAt: '2026-10-04T00:00:00Z',
    updatedAt: '2026-10-04T00:00:00Z',
    code: 'PARTNER',
    discountType: 'percentage',
    discountValue: 0,
    minimumAmountMinor: 0,
    startsAt: null,
    expiresAt: null,
    maxUses: null,
    maxUsesPerUser: null,
    scope: 'ALL',
    productIds: [],
    categoryIds: [],
    firstPurchaseOnly: false,
    status: 'active',
  };
  expect(couponSchema.safeParse(coupon).success).toBe(true);
  expect(couponSchema.safeParse({ ...coupon, discountType: 'fixed' }).success).toBe(false);
});
