// @vitest-environment jsdom
import React from 'react';
import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { CitizenContext, CitizenProvider } from '@/components/site/citizen-provider';
import { CryptoBalance, CryptoBalanceValue } from '@/components/site/crypto-balance';
import { formatCrypto } from '@/lib/api/citizen-contracts';
vi.mock('next/navigation', () => ({ usePathname: () => '/minha-conta' }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it.each([
  ['0', '0'],
  ['1250', '1.250'],
  ['1000000', '1.000.000'],
  ['9007199254740993', '9.007.199.254.740.993'],
])('saldo %s não usa float', (balance, formatted) => {
  render(<CryptoBalanceValue state={{ status: 'ready', balance, asOf: '2026-10-04T00:00:00Z' }} />);
  expect(screen.getByRole('link', { name: `Saldo: ${formatted} Crypto` }).getAttribute('href')).toBe('/#crypto');
});
it.each(['loading', 'error'] as const)('%s não cria saldo zero', (status) => {
  render(<CryptoBalanceValue state={{ status }} />);
  expect(screen.queryByText('0')).toBeNull();
  expect(screen.getByText('—')).toBeTruthy();
});
it('inteiro inválido não é arredondado', () => {
  expect(() => formatCrypto('1.25')).toThrow();
});
it('deslogado não vê saldo', () => {
  render(
    <CitizenContext.Provider
      value={{ session: { status: 'unauthenticated' }, balance: { status: 'loading' }, refresh: () => {} }}
    >
      <CryptoBalance />
    </CitizenContext.Provider>,
  );
  expect(screen.queryByRole('link')).toBeNull();
});
it('saldo mobile mantém valor e não integra dropdown', () => {
  render(
    <CitizenContext.Provider
      value={{
        session: { status: 'authenticated', user: { name: 'Tec' } },
        balance: { status: 'ready', balance: '1250', asOf: '2026-10-04T00:00:00Z' },
        refresh: () => {},
      }}
    >
      <CryptoBalance mobile />
    </CitizenContext.Provider>,
  );
  expect(screen.getByRole('link', { name: 'Saldo: 1.250 Crypto' }).closest('.crypto-mobile')).toBeTruthy();
  expect(screen.queryByRole('menu')).toBeNull();
});
it('navbar e perfil compartilham uma consulta e atualizam em evento financeiro', async () => {
  let balance = '1250';
  const fetcher = vi.fn(async (url: string) =>
    Response.json(
      url.includes('/session')
        ? { user: { name: 'Tec' } }
        : { balance, currency: 'CRYPTO', asOf: '2026-10-04T00:00:00Z' },
    ),
  );
  vi.stubGlobal('fetch', fetcher);
  render(
    <CitizenProvider>
      <CryptoBalance />
      <CryptoBalance card />
    </CitizenProvider>,
  );
  await waitFor(() => expect(screen.getAllByRole('link', { name: 'Saldo: 1.250 Crypto' })).toHaveLength(2));
  expect(fetcher.mock.calls.filter((c) => c[0] === '/api/me/crypto')).toHaveLength(1);
  balance = '50';
  window.dispatchEvent(new Event('suburbio:balance-changed'));
  await waitFor(() => expect(screen.getAllByRole('link', { name: 'Saldo: 50 Crypto' })).toHaveLength(2));
});

it('focus bursts share the in-flight access request and revalidate after completion', async () => {
  let complete: ((value: Response) => void) | undefined;
  const fetcher = vi.fn((url: string) => {
    if (url === '/api/me/access')
      return new Promise<Response>((resolve) => {
        complete = resolve;
      });
    return Promise.resolve(
      Response.json(
        url.includes('/session')
          ? { user: { name: 'Tec' } }
          : { balance: '1250', currency: 'CRYPTO', asOf: '2026-10-04T00:00:00Z' },
      ),
    );
  });
  vi.stubGlobal('fetch', fetcher);
  render(
    <CitizenProvider>
      <CryptoBalance />
    </CitizenProvider>,
  );
  await waitFor(() => expect(complete).toBeTruthy());
  window.dispatchEvent(new Event('focus'));
  window.dispatchEvent(new Event('focus'));
  expect(fetcher.mock.calls.filter((c) => c[0] === '/api/me/access')).toHaveLength(1);
  complete!(Response.json({ affiliate: true, admin: false }));
  await screen.findByRole('link', { name: 'Saldo: 1.250 Crypto' });
  await new Promise((r) => setTimeout(r, 0));
  window.dispatchEvent(new Event('focus'));
  await waitFor(() => expect(fetcher.mock.calls.filter((c) => c[0] === '/api/me/access')).toHaveLength(2));
  complete!(Response.json({ affiliate: false, admin: false }));
});
