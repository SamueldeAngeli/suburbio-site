// @vitest-environment jsdom
import React from 'react';
import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
vi.mock('@/lib/auth/actions', () => ({ loginDiscord: vi.fn(), logout: vi.fn() }));
import { UserMenu } from '@/components/site/user-nav';
import { AffiliateDashboard } from '@/components/affiliate/dashboard';
import { moneyMinor } from '@/lib/format-money';
import { dashboardSchema } from '@/lib/api/affiliate-contracts';
import fixture from './fixtures/affiliate.json';
import { storedReferral, REFERRAL_TTL } from '@/lib/affiliate-referral';
afterEach(cleanup);
it.each([
  [false, false, ['Ver perfil', 'Sair']],
  [true, false, ['Ver perfil', 'Afiliado', 'Sair']],
  [false, true, ['Ver perfil', 'Admin', 'Sair']],
  [true, true, ['Ver perfil', 'Afiliado', 'Admin', 'Sair']],
] as const)('dropdown affiliate=%s admin=%s', async (affiliate, admin, labels) => {
  render(<UserMenu state={{ status: 'authenticated', user: { name: 'Teste' } }} access={{ affiliate, admin }} />);
  await userEvent.click(screen.getByRole('button', { name: 'Conta de Teste' }));
  expect(screen.getAllByRole('menuitem').map((e) => e.textContent)).toEqual(labels);
});
it('dashboard shows distinct rates and coupon', () => {
  render(<AffiliateDashboard data={dashboardSchema.parse(fixture)} />);
  expect(screen.getByText('TECCODE')).toBeTruthy();
  expect(screen.getByText('5%')).toBeTruthy();
  expect(screen.getByText('8%')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Seu link de indicação' }).getAttribute('href')).toBe('/?ref=TECCODE');
});
it('sales table exposes benefit, quantity and status', () => {
  render(<AffiliateDashboard data={dashboardSchema.parse(fixture)} />);
  expect(screen.getByRole('table').textContent).toContain('VIP Elite');
  expect(screen.getByRole('table').textContent).toContain('Revertido');
});
it('chart has accessible values and period links', () => {
  render(<AffiliateDashboard data={dashboardSchema.parse(fixture)} />);
  expect(screen.getByRole('img', { name: 'Gráfico de comissões por dia' })).toBeTruthy();
  expect(screen.getByRole('link', { name: '7 dias' }).getAttribute('href')).toBe('/minha-conta/afiliado?period=7');
  expect(screen.getByRole('link', { name: '30 dias' }).getAttribute('aria-current')).toBe('page');
});
it('empty state keeps coupon and real zeros', () => {
  const data = dashboardSchema.parse(fixture);
  data.sales = [];
  data.chart = [];
  data.total = 0;
  data.summary = {
    soldMinor: '0',
    generatedMinor: '0',
    pendingMinor: '0',
    availableMinor: '0',
    paidMinor: '0',
    reversedMinor: '0',
    debtMinor: '0',
    purchases: 0,
    buyers: 0,
  };
  render(<AffiliateDashboard data={data} />);
  expect(screen.getByText('TECCODE')).toBeTruthy();
  expect(screen.getByText('Nenhuma venda registrada neste período.')).toBeTruthy();
  expect(screen.getAllByText('R$ 0,00').length).toBeGreaterThan(0);
});
it('money formatter preserves amounts beyond float precision', () =>
  expect(moneyMinor('9007199254740993')).toBe('R$ 90.071.992.547.409,93'));
it('referral expires after seven days', () => {
  const now = 1000000000;
  expect(storedReferral(JSON.stringify({ code: 'TECCODE', expiresAt: now + REFERRAL_TTL }), now)).toBe('TECCODE');
  expect(storedReferral(JSON.stringify({ code: 'TECCODE', expiresAt: now }), now)).toBeNull();
});
it('malformed referral cannot supply a URL or infinite lifetime', () => {
  expect(storedReferral('{')).toBeNull();
  expect(storedReferral(JSON.stringify({ code: 'https://invalid', expiresAt: Date.now() + 1000 }))).toBeNull();
});
