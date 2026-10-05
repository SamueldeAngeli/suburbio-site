import { beforeEach, it, expect, vi } from 'vitest';
import { config, discordId, playerId, operationId } from './fixtures';
const mocks = vi.hoisted(() => ({ session: vi.fn(), checkout: vi.fn(), create: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ currentSession: mocks.session }));
vi.mock('@/lib/server/env', async (original) => ({ ...(await original<object>()), serverEnv: () => config }));
vi.mock('@/lib/api/client', () => ({
  SuburbioApiClient: class {
    checkout = mocks.checkout;
    createOrder = mocks.create;
  },
}));
import { POST } from '@/app/api/vip/orders/checkout/route';
import { POST as create } from '@/app/api/vip/orders/create/route';
const request = (extra: object = {}, origin = config.AUTH_URL!) =>
  new Request('http://localhost/api/vip/orders/checkout', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json', 'x-suburbio-intent': 'order.checkout' },
    body: JSON.stringify({ id: playerId, idempotencyKey: operationId, ...extra }),
  });
const cartRequest = (extra: object = {}) =>
  new Request('http://localhost/api/vip/orders/create', {
    method: 'POST',
    headers: { origin: config.AUTH_URL!, 'content-type': 'application/json', 'x-suburbio-intent': 'order.create' },
    body: JSON.stringify({
      items: [{ kind: 'crypto', mode: 'custom', quantity: 500 }],
      idempotencyKey: operationId,
      ...extra,
    }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ user: { discordId } });
  mocks.checkout.mockResolvedValue({ data: { checkoutUrl: 'https://sandbox.mercadopago.com.br/checkout' } });
  mocks.create.mockResolvedValue({ data: { order: { id: playerId } } });
});
it('checkout exige sessão', async () => {
  mocks.session.mockResolvedValue(null);
  expect((await POST(request())).status).toBe(401);
  expect(mocks.checkout).not.toHaveBeenCalled();
});
it('checkout rejeita CSRF', async () => {
  expect((await POST(request({}, 'https://evil.example'))).status).toBe(403);
  expect(mocks.checkout).not.toHaveBeenCalled();
});
it('checkout rejeita preço e identidade do browser', async () => {
  for (const extra of [{ amountMinor: 1 }, { customerDiscordId: discordId }])
    expect((await POST(request(extra))).status).toBe(400);
  expect(mocks.checkout).not.toHaveBeenCalled();
});
it('checkout usa identidade da sessão e chave de retry', async () => {
  expect((await POST(request())).status).toBe(200);
  expect(mocks.checkout).toHaveBeenCalledWith(discordId, playerId, operationId);
});
it('criação exige sessão', async () => {
  mocks.session.mockResolvedValue(null);
  expect((await create(cartRequest())).status).toBe(401);
});
it('criação não aceita preço do carrinho', async () => {
  expect((await create(cartRequest({ price: 1 }))).status).toBe(400);
  expect(mocks.create).not.toHaveBeenCalled();
});
it('criação preserva 500 Crypto, cupom e chave', async () => {
  expect((await create(cartRequest({ couponCode: 'PROMO' }))).status).toBe(200);
  expect(mocks.create).toHaveBeenCalledWith(
    discordId,
    { items: [{ kind: 'crypto', mode: 'custom', quantity: 500, units: 1 }], couponCode: 'PROMO' },
    operationId,
  );
});

it.each([{ recipientDiscordId: '123456789012345678' }, { recipientId: playerId }, { anonymous: true }])(
  'pedido rejeita presente sem contrato %j',
  async (extra) => {
    expect((await create(cartRequest(extra))).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  },
);
