import { describe, it, expect, vi, beforeEach } from 'vitest';
import { config, admin, playerId } from './fixtures';
import { SiteError } from '@/lib/api/errors';
import { productInput } from '@/lib/api/catalog-contracts';
const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), saveProduct: vi.fn(), saveCategory: vi.fn() }));
vi.mock('@/lib/permissions/guards', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('@/lib/server/env', async (original) => ({ ...(await original<object>()), serverEnv: () => config }));
vi.mock('@/lib/api/client', () => ({
  SuburbioApiClient: class {
    saveProduct = mocks.saveProduct;
    saveCategory = mocks.saveCategory;
  },
}));
import { POST as saveProduct } from '@/app/api/admin/products/route';
import { POST as saveCategory } from '@/app/api/admin/categories/route';
const product = {
  name: 'VIP Cria',
  slug: 'vip-cria',
  description: 'Plano de teste',
  categoryId: playerId,
  imageUrl: '',
  status: 'active',
  displayOrder: 0,
  salesChannels: ['SITE_VIP'],
  priceCrypto: 0,
  priceMinor: 2990,
  stockMode: 'UNLIMITED',
  stockQuantity: 0,
  validityMode: 'DURATION',
  durationDays: 30,
  renewable: true,
  delivery: { deliveryType: 'VIP', deliveryPayload: { plan: 'cria' } },
};
const request = (body: unknown, intent = 'product.save', origin = config.AUTH_URL!) =>
  new Request('http://localhost/api/admin/products', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'x-suburbio-intent': intent },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ ...admin, capabilities: ['PRODUCTS_CREATE', 'PRODUCTS_UPDATE'] });
  mocks.saveProduct.mockResolvedValue({ data: { product } });
});
describe('Catálogo: validação e BFF', () => {
  it('valida payload de entrega pelo tipo', () =>
    expect(
      productInput.safeParse({ ...product, delivery: { deliveryType: 'VEHICLE', deliveryPayload: { plan: 'cria' } } })
        .success,
    ).toBe(false));
  it('rejeita URL de imagem insegura', () =>
    expect(productInput.safeParse({ ...product, imageUrl: 'javascript:alert(1)' }).success).toBe(false));
  it('rejeita quantidade negativa', () =>
    expect(productInput.safeParse({ ...product, stockQuantity: -1 }).success).toBe(false));
  it('rejeita campos desconhecidos de produto', () =>
    expect(productInput.safeParse({ ...product, isSystemOwner: true }).success).toBe(false));
  it('CSRF não chama API', async () => {
    expect(
      (await saveProduct(request({ product, idempotencyKey: 'test-product' }, 'product.save', 'https://evil.example')))
        .status,
    ).toBe(403);
    expect(mocks.saveProduct).not.toHaveBeenCalled();
  });
  it('ator do browser rejeitado', async () => {
    expect(
      (await saveProduct(request({ product, idempotencyKey: 'test-product', actorDiscordId: admin.discordId }))).status,
    ).toBe(400);
    expect(mocks.saveProduct).not.toHaveBeenCalled();
  });
  it('exige capability de criação e usa ator da sessão', async () => {
    expect((await saveProduct(request({ product, idempotencyKey: 'test-product' }))).status).toBe(200);
    expect(mocks.requireAdmin).toHaveBeenCalledWith('PRODUCTS_CREATE');
    expect(mocks.saveProduct.mock.calls[0][0]).toBe(admin.discordId);
  });
  it('edição exige PRODUCTS_UPDATE', async () => {
    expect(
      (await saveProduct(request({ product, id: playerId, expectedRevision: 1, idempotencyKey: 'test-product' })))
        .status,
    ).toBe(200);
    expect(mocks.requireAdmin).toHaveBeenCalledWith('PRODUCTS_UPDATE');
  });
  it('sem PRODUCTS_DISABLE não arquiva', async () => {
    expect(
      (await saveProduct(request({ product: { ...product, status: 'archived' }, idempotencyKey: 'test-product' })))
        .status,
    ).toBe(403);
    expect(mocks.saveProduct).not.toHaveBeenCalled();
  });
  it('readOnly bloqueia antes do transporte', async () => {
    mocks.requireAdmin.mockResolvedValue({ ...admin, readOnly: true });
    expect((await saveProduct(request({ product, idempotencyKey: 'test-product' }))).status).toBe(503);
    expect(mocks.saveProduct).not.toHaveBeenCalled();
  });
  it('sem sessão não salva', async () => {
    mocks.requireAdmin.mockRejectedValue(new SiteError('SESSION_REQUIRED', 401));
    expect((await saveProduct(request({ product, idempotencyKey: 'test-product' }))).status).toBe(401);
  });
  it('categoria não aceita ator do browser', async () => {
    expect(
      (
        await saveCategory(
          request(
            {
              category: { name: 'VIP', slug: 'vip', displayOrder: 0, status: 'active' },
              actorDiscordId: admin.discordId,
              idempotencyKey: 'test-category',
            },
            'category.save',
          ),
        )
      ).status,
    ).toBe(400);
    expect(mocks.saveCategory).not.toHaveBeenCalled();
  });
});
