import { describe, it, expect, vi, beforeEach } from 'vitest';
import { config, discordId, playerId } from './fixtures';
import { cryptoPreviewFromId } from '@/lib/crypto-preview';
import { cartInput } from '@/lib/api/cart-contracts';
import { SiteError } from '@/lib/api/errors';
const mocks = vi.hoisted(() => ({ session: vi.fn(), quote: vi.fn(), catalog: vi.fn(), crypto: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ currentSession: mocks.session }));
vi.mock('@/lib/server/env', async (original) => ({ ...(await original<object>()), serverEnv: () => config }));
vi.mock('@/lib/api/client', () => ({
  SuburbioApiClient: class {
    cartQuote = mocks.quote;
    catalog = mocks.catalog;
    cryptoConfig = mocks.crypto;
  },
}));
import { POST } from '@/app/api/vip/quote/route';
import { GET } from '@/app/api/vip/catalog/route';
const request = (body: unknown, origin = config.AUTH_URL!) =>
  new Request('http://localhost/api/vip/quote', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'x-suburbio-intent': 'cart.quote' },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ user: { discordId } });
});
describe('Carrinho VIP + Crypto', () => {
  it('restauração não aceita preço embutido em identificador', () =>
    expect(cryptoPreviewFromId('crypto-custom-325-price-1')).toBeNull());
  it('restaura quantidade e tipo, recalculando apresentação', () =>
    expect(cryptoPreviewFromId('crypto-custom-325')).toMatchObject({ price: 406.25, category: 'Crypto' }));
  it('preço enviado pelo client é rejeitado pelo contrato', () =>
    expect(
      cartInput.safeParse({ items: [{ kind: 'product', productId: playerId, quantity: 1, price: 1 }] }).success,
    ).toBe(false));
  it('permite múltiplos pacotes sem mudar a quantidade unitária', () =>
    expect(
      cartInput.parse({ items: [{ kind: 'crypto', mode: 'package', quantity: 300, units: 2 }] }).items[0],
    ).toMatchObject({ quantity: 300, units: 2 }));
  it('quote exige sessão', async () => {
    mocks.session.mockResolvedValue(null);
    expect((await POST(request({ items: [] }))).status).toBe(401);
    expect(mocks.quote).not.toHaveBeenCalled();
  });
  it('quote rejeita origem externa', async () => {
    expect((await POST(request({ items: [] }, 'https://evil.example'))).status).toBe(403);
    expect(mocks.quote).not.toHaveBeenCalled();
  });
  it('quote repassa identificadores para cálculo da API', async () => {
    const body = { items: [{ kind: 'crypto', mode: 'package', quantity: 300, units: 1 }] };
    mocks.quote.mockResolvedValue({ data: { netAmountMinor: 36000 } });
    const r = await POST(request(body));
    expect(r.status).toBe(200);
    expect(mocks.quote).toHaveBeenCalledWith(body, discordId);
    expect(r.headers.get('cache-control')).toContain('no-store');
  });
  it('catálogo indisponível não substitui dados reais por demo', async () => {
    mocks.catalog.mockRejectedValue(new SiteError('API_OFFLINE'));
    mocks.crypto.mockResolvedValue({ data: {} });
    const r = await GET();
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain('"mode":"demo"');
  });
});
