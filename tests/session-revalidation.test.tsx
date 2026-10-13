// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ redirect: vi.fn(), path: '/' }));
vi.mock('@/lib/client-navigation', () => ({ redirectTo: m.redirect }));
vi.mock('next/navigation', () => ({ usePathname: () => m.path }));
import { CitizenProvider, notifyUnauthorized, useCitizen } from '@/components/site/citizen-provider';

const user = { name: 'Ana', discordId: '123456789012345678', image: undefined };
let sessionUser: typeof user | null;
let accessStatus: number;
const calls: string[] = [];
function Probe() {
  const c = useCitizen()!;
  return (
    <span data-testid="state">
      {c.session.status}|{c.access?.admin ? 'admin' : 'no-admin'}
    </span>
  );
}
const state = () => screen.getByTestId('state').textContent;
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  sessionUser = user;
  accessStatus = 200;
  calls.length = 0;
  m.redirect.mockClear();
  m.path = '/';
  window.history.replaceState(null, '', '/');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url);
      if (url === '/api/auth/session') return Response.json(sessionUser ? { user: sessionUser } : {});
      if (url === '/api/me/access')
        return accessStatus === 200
          ? Response.json({ affiliate: false, admin: true })
          : Response.json({ error: { code: 'X' } }, { status: accessStatus });
      if (url === '/api/me/crypto')
        return Response.json({ balance: '0', currency: 'CRYPTO', asOf: '2026-10-13T00:00:00Z' });
      return new Response(null, { status: 404 });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const sessionChecks = () => calls.filter((c) => c === '/api/auth/session').length;

it('sessão expirada passa a deslogado ao recuperar o foco', async () => {
  render(
    <CitizenProvider>
      <Probe />
    </CitizenProvider>,
  );
  await waitFor(() => expect(state()).toBe('authenticated|admin'));
  sessionUser = null;
  await act(async () => {
    vi.advanceTimersByTime(16_000);
    window.dispatchEvent(new Event('focus'));
  });
  await waitFor(() => expect(state()).toBe('unauthenticated|no-admin'));
  expect(m.redirect).not.toHaveBeenCalled(); // página pública: só atualiza a UI
});

it('401 de qualquer chamada revalida na hora; página protegida volta ao login com a URL', async () => {
  m.path = '/minha-conta/pedidos';
  window.history.replaceState(null, '', '/minha-conta/pedidos?page=2');
  render(
    <CitizenProvider>
      <Probe />
    </CitizenProvider>,
  );
  await waitFor(() => expect(state()).toBe('authenticated|admin'));
  sessionUser = null;
  await act(async () => notifyUnauthorized());
  await waitFor(() => expect(state()).toBe('unauthenticated|no-admin'));
  expect(m.redirect).toHaveBeenCalledWith('/login?returnTo=%2Fminha-conta%2Fpedidos%3Fpage%3D2');
});

it('403 não desloga: só remove o acesso administrativo', async () => {
  accessStatus = 403;
  render(
    <CitizenProvider>
      <Probe />
    </CitizenProvider>,
  );
  await waitFor(() => expect(state()).toBe('authenticated|no-admin'));
  const before = sessionChecks();
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(state()).toBe('authenticated|no-admin');
  expect(sessionChecks()).toBe(before); // foco dentro do intervalo mínimo: sem nova checagem
});

it('falha de rede na revalidação não desloga nem afirma sessão inválida', async () => {
  render(
    <CitizenProvider>
      <Probe />
    </CitizenProvider>,
  );
  await waitFor(() => expect(state()).toBe('authenticated|admin'));
  vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
  await act(async () => notifyUnauthorized());
  expect(state()).toBe('authenticated|admin');
  expect(m.redirect).not.toHaveBeenCalled();
});

it('revalidação periódica só a cada 5 minutos com a aba visível', async () => {
  render(
    <CitizenProvider>
      <Probe />
    </CitizenProvider>,
  );
  await waitFor(() => expect(state()).toBe('authenticated|admin'));
  const before = sessionChecks();
  await act(async () => vi.advanceTimersByTime(60_000));
  expect(sessionChecks()).toBe(before);
  await act(async () => vi.advanceTimersByTime(5 * 60_000));
  await waitFor(() => expect(sessionChecks()).toBe(before + 1));
});
