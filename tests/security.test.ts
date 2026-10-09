import { describe, it, expect } from 'vitest';
import { parseServerEnv } from '@/lib/server/env';
import { WindowLimiter, assertOrigin, readJson, safeReturnTo } from '@/lib/server/security';
import { listQuerySchema, PendingAdminService } from '@/lib/api/modules/pending';
import { AccountService } from '@/lib/api/modules/accounts';
import { SuburbioApiClient } from '@/lib/api/client';
import { errorResponse } from '@/lib/api/errors';
import { discordId } from './fixtures';
describe('Configuração e limites', () => {
  it('permite site público sem credenciais e com integrações desligadas', () =>
    expect(parseServerEnv({}).AUTH_ENABLED).toBe(false));
  it('auth habilitado falha se secret ausente sem revelar valores', () =>
    expect(() => parseServerEnv({ AUTH_ENABLED: 'true', AUTH_URL: 'http://localhost:3001' })).toThrow('AUTH_SECRET'));
  it('produção exige HTTPS para login', () =>
    expect(() =>
      parseServerEnv({ NODE_ENV: 'production', AUTH_ENABLED: 'true', AUTH_URL: 'http://localhost:3001' }),
    ).toThrow('HTTPS'));
  it('API habilitada exige service secret', () =>
    expect(() => parseServerEnv({ SUBURBIO_API_ENABLED: 'true', SUBURBIO_API_URL: 'http://127.0.0.1:3000' })).toThrow(
      'SITE_SERVICE_SECRET',
    ));
  it.each([
    'https://user:pass@api.example',
    'file:///tmp/api',
    'https://api.example/path',
    'https://api.example?url=x',
  ])('rejeita origem insegura %s', (url) =>
    expect(() => parseServerEnv({ SUBURBIO_API_ENABLED: 'true', SUBURBIO_API_URL: url })).toThrow(),
  );
  it('limite expira sem permitir excesso', () => {
    const limiter = new WindowLimiter();
    limiter.consume('actor', 1, 100, 0);
    expect(() => limiter.consume('actor', 1, 100, 1)).toThrow();
    expect(() => limiter.consume('actor', 1, 100, 101)).not.toThrow();
  });
  it('capacidade do limiter falha fechada, sem eviction explorável', () => {
    const limiter = new WindowLimiter(1);
    limiter.consume('one', 2);
    expect(() => limiter.consume('two', 2)).toThrow();
  });
  it('CSRF exige origem exata', () => {
    expect(() => assertOrigin(new Headers({ Origin: 'https://evil.example' }), 'https://site.example')).toThrow();
    expect(() => assertOrigin(new Headers(), 'https://site.example')).toThrow();
    expect(() => assertOrigin(new Headers({ Origin: 'https://site.example' }), 'https://site.example')).not.toThrow();
  });
  it('CSRF rejeita fetch-site cross-site', () =>
    expect(() =>
      assertOrigin(
        new Headers({ Origin: 'https://site.example', 'Sec-Fetch-Site': 'cross-site' }),
        'https://site.example',
      ),
    ).toThrow());
  it('JSON tem limite real de bytes mesmo sem content-length', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'x'.repeat(5000) }),
    });
    await expect(readJson(req)).rejects.toMatchObject({ status: 413 });
  });
  it('JSON inválido não expõe payload', async () => {
    await expect(
      readJson(
        new Request('http://localhost', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: 'secret',
        }),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/api/auth/signout',
    '/minha-conta/../api/auth/signout',
    '/minha-conta//evil.example',
    '/minha-conta?next=https://evil.example',
    '/tela?room=ABCDEF1234&x=1',
    '/tela?room=https://evil.example',
    '/tela/../admin',
    '/minha-conta%2F%2Fevil.example',
    'javascript:alert(1)',
    '',
    null,
  ])('bloqueia retorno aberto %s', (url) => expect(safeReturnTo(url)).toBe('/minha-conta'));
  it.each([
    '/admin',
    '/admin/orders',
    '/minha-conta',
    '/minha-conta/afiliado',
    '/minha-conta/pedidos/0b5f5a8e-1c1e-4d8a-9c3f-2b3a4c5d6e7f',
    '/tela',
    '/tela?room=ABCDEF1234',
  ])('preserva retorno interno %s', (url) => expect(safeReturnTo(url)).toBe(url));
  it('paginação e filtros são normalizados no servidor', () =>
    expect(
      listQuerySchema.parse({ page: '2', pageSize: '25', q: ' cidadão ', from: '2026-09-01', to: '2026-09-26' }),
    ).toMatchObject({ page: 2, pageSize: 25, q: 'cidadão' }));
  it.each([{ page: 0 }, { pageSize: 1000 }, { q: 'x'.repeat(101) }, { from: '2026-10-01', to: '2026-09-01' }])(
    'rejeita paginação/filtros inválidos %j',
    (query) => expect(listQuerySchema.safeParse(query).success).toBe(false),
  );
  it('erro inesperado é sanitizado e não cacheável', async () => {
    const response = errorResponse(new Error('password=secret'));
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.text()).not.toContain('password=secret');
  });
});
describe('Gaps nunca viram mocks administrativos', () => {
  it('resolução de conta sem API configurada falha fechada', async () =>
    await expect(new AccountService().resolve(discordId)).rejects.toMatchObject({ code: 'API_NOT_CONFIGURED' }));
  it('catálogo real não retorna benefícios demo', async () =>
    await expect(new SuburbioApiClient().catalog()).rejects.toMatchObject({ code: 'API_NOT_CONFIGURED' }));
  it.each(['players', 'orders', 'payments', 'audit'] as const)(
    '%s sem endpoint não cria dados',
    async (method) =>
      await expect(new PendingAdminService()[method](listQuerySchema.parse({}))).rejects.toMatchObject({
        code: 'API_GAP',
      }),
  );
});
