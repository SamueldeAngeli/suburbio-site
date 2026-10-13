'use client';
import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { publicProfile, type PublicProfile } from '@/lib/public-profile';
import { balanceSchema } from '@/lib/api/citizen-contracts';
import { redirectTo } from '@/lib/client-navigation';
export type CitizenSession =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; user: PublicProfile };
export type BalanceState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; balance: string; asOf: string };
export const CitizenContext = createContext<{
  session: CitizenSession;
  balance: BalanceState;
  access?: { affiliate: boolean; admin: boolean };
  refresh: () => void;
} | null>(null);
export const useCitizen = () => useContext(CitizenContext);
// Qualquer chamada do browser ao BFF que receba 401 avisa o provider para revalidar a sessão já.
export const SESSION_UNAUTHORIZED = 'suburbio:session-unauthorized';
export const notifyUnauthorized = () => window.dispatchEvent(new Event(SESSION_UNAUTHORIZED));
const PROTECTED = /^\/(?:minha-conta|admin|tela)(?:\/|$)/;
const NO_ACCESS = { affiliate: false, admin: false };
const MIN_INTERVAL = 15_000,
  PERIODIC = 5 * 60_000;
export function CitizenProvider({ children }: { children: React.ReactNode }) {
  const [access, setAccess] = useState({ affiliate: false, admin: false });
  const [session, setSession] = useState<CitizenSession>({ status: 'loading' }),
    [balance, setBalance] = useState<BalanceState>({ status: 'loading' });
  const path = usePathname();
  const pending = useRef<AbortController | null>(null),
    last = useRef(0),
    checking = useRef(false),
    checked = useRef(0),
    snapshot = useRef('');
  // Auth.js é a fonte de verdade. Sessão comprovadamente inválida nunca continua "logada" na UI;
  // falha de rede mantém o estado atual (não prova nada) e 403 nunca passa por aqui.
  const revalidate = useCallback((force = false) => {
    if (checking.current || (!force && Date.now() - checked.current < MIN_INTERVAL)) return;
    checking.current = true;
    checked.current = Date.now();
    fetch('/api/auth/session', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw Error();
        const user = publicProfile((await r.json())?.user);
        if (user) {
          const next = JSON.stringify(user);
          if (next !== snapshot.current) {
            snapshot.current = next;
            setSession({ status: 'authenticated', user });
          }
          return;
        }
        snapshot.current = '';
        setSession({ status: 'unauthenticated' });
        setAccess({ affiliate: false, admin: false });
        if (PROTECTED.test(location.pathname))
          redirectTo(`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`);
      })
      .catch(() => setSession((current) => (current.status === 'loading' ? { status: 'error' } : current)))
      .finally(() => {
        checking.current = false;
      });
  }, []);
  useEffect(() => {
    revalidate(true);
    const visible = () => {
        if (!document.hidden) revalidate();
      },
      unauthorized = () => revalidate(true);
    const timer = window.setInterval(visible, PERIODIC);
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    window.addEventListener(SESSION_UNAUTHORIZED, unauthorized);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', visible);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener(SESSION_UNAUTHORIZED, unauthorized);
      pending.current?.abort();
    };
  }, [revalidate]);
  useEffect(() => {
    revalidate();
  }, [path, revalidate]);
  useEffect(() => {
    if (session.status !== 'authenticated') return;
    const abort = new AbortController();
    let running = false;
    const refresh = () => {
      if (running || abort.signal.aborted) return;
      running = true;
      fetch('/api/me/access', { cache: 'no-store', signal: abort.signal })
        .then(async (r) => {
          if (r.status === 401) revalidate(true);
          if (!r.ok) throw Error();
          const value = await r.json();
          if (!abort.signal.aborted) setAccess({ affiliate: value.affiliate === true, admin: value.admin === true });
        })
        .catch(() => {
          if (!abort.signal.aborted) setAccess({ affiliate: false, admin: false });
        })
        .finally(() => {
          running = false;
        });
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => {
      abort.abort();
      window.removeEventListener('focus', refresh);
    };
  }, [session.status, path, revalidate]);
  const load = useCallback(
    (force = false) => {
      if (session.status !== 'authenticated' || pending.current || (!force && Date.now() - last.current < 30000))
        return;
      const abort = new AbortController();
      pending.current = abort;
      setBalance({ status: 'loading' });
      fetch('/api/me/crypto', { cache: 'no-store', signal: abort.signal })
        .then(async (r) => {
          if (r.status === 401) revalidate(true);
          if (!r.ok) throw Error();
          const result = balanceSchema.parse(await r.json());
          if (!abort.signal.aborted) {
            last.current = Date.now();
            setBalance({ status: 'ready', balance: result.balance, asOf: result.asOf });
          }
        })
        .catch(() => {
          if (!abort.signal.aborted) {
            last.current = Date.now();
            setBalance({ status: 'error' });
          }
        })
        .finally(() => {
          if (pending.current === abort) pending.current = null;
        });
    },
    [session.status, revalidate],
  );
  useEffect(() => {
    load(true);
  }, [path, load]);
  useEffect(() => {
    const focus = () => {
        if (!document.hidden) load();
      },
      refresh = () => load(true);
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    window.addEventListener('suburbio:balance-changed', refresh);
    return () => {
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', focus);
      window.removeEventListener('suburbio:balance-changed', refresh);
    };
  }, [load]);
  return (
    <CitizenContext.Provider
      value={{
        session,
        balance,
        // Sem sessão autenticada não há acesso, mesmo com resposta antiga ainda em voo.
        access: session.status === 'authenticated' ? access : NO_ACCESS,
        refresh: () => load(true),
      }}
    >
      {children}
    </CitizenContext.Provider>
  );
}
