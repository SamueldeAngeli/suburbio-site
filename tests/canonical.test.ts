import { describe, it, expect } from 'vitest';
import { canonicalOrigin, wwwRedirects } from '@/lib/canonical';
import config from '../next.config';

describe('origem canônica (AUTH_URL)', () => {
  it('produção: raiz HTTPS, sem barra/caminho', () =>
    expect(canonicalOrigin('https://suburbioroleplay.com')?.href).toBe('https://suburbioroleplay.com/'));
  it('desenvolvimento continua em localhost', () =>
    expect(canonicalOrigin('http://localhost:3002')?.origin).toBe('http://localhost:3002'));
  it.each([undefined, '', 'nao-e-url', 'javascript:alert(1)'])('inválida vira null: %s', (v) =>
    expect(canonicalOrigin(v)).toBeNull(),
  );
});

describe('www → raiz', () => {
  it('redireciona permanentemente só o host www exato, preservando caminho', () => {
    const [rule] = wwwRedirects('https://suburbioroleplay.com');
    expect(rule).toEqual({
      source: '/:path*',
      has: [{ type: 'host', value: 'www\\.suburbioroleplay\\.com' }],
      destination: 'https://suburbioroleplay.com/:path*',
      permanent: true,
    });
    const host = new RegExp(`^${rule!.has[0]!.value}$`);
    expect(host.test('www.suburbioroleplay.com')).toBe(true);
    // Proxy local (Host 127.0.0.1) e a própria raiz nunca casam: sem loop.
    for (const other of ['suburbioroleplay.com', '127.0.0.1', '127.0.0.1:3002', 'wwwXsuburbioroleplay.com'])
      expect(host.test(other)).toBe(false);
  });
  it.each([undefined, 'http://localhost:3002', 'http://127.0.0.1:3002', 'https://www.suburbioroleplay.com'])(
    'sem regra para %s',
    (v) => expect(wwwRedirects(v)).toEqual([]),
  );
  it('next.config aplica a regra a partir de AUTH_URL', async () => {
    const previous = process.env.AUTH_URL;
    process.env.AUTH_URL = 'https://suburbioroleplay.com';
    try {
      expect(await config.redirects!()).toHaveLength(1);
    } finally {
      if (previous === undefined) delete process.env.AUTH_URL;
      else process.env.AUTH_URL = previous;
    }
  });
});
