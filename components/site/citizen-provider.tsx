'use client';
import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { publicProfile, type PublicProfile } from '@/lib/public-profile';
import { balanceSchema } from '@/lib/api/citizen-contracts';
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
export function CitizenProvider({ children }: { children: React.ReactNode }) {
  const [access, setAccess] = useState({ affiliate: false, admin: false });
  const [session, setSession] = useState<CitizenSession>({ status: 'loading' }),
    [balance, setBalance] = useState<BalanceState>({ status: 'loading' });
  const path = usePathname();
  const pending = useRef<AbortController | null>(null),
    last = useRef(0);
  useEffect(() => {
    const abort = new AbortController();
    fetch('/api/auth/session', { cache: 'no-store', signal: abort.signal })
      .then(async (r) => {
        if (!r.ok) throw Error();
        const body = await r.json();
        if (abort.signal.aborted) return;
        const user = publicProfile(body?.user);
        setSession(user ? { status: 'authenticated', user } : { status: 'unauthenticated' });
      })
      .catch(() => {
        if (!abort.signal.aborted) setSession({ status: 'error' });
      });
    return () => {
      abort.abort();
      pending.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (session.status !== 'authenticated') return;
    const abort = new AbortController();
    let running = false;
    const refresh = () => {
      if (running || abort.signal.aborted) return;
      running = true;
      fetch('/api/me/access', { cache: 'no-store', signal: abort.signal })
        .then(async (r) => {
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
  }, [session.status, path]);
  const load = useCallback(
    (force = false) => {
      if (session.status !== 'authenticated' || pending.current || (!force && Date.now() - last.current < 30000))
        return;
      const abort = new AbortController();
      pending.current = abort;
      setBalance({ status: 'loading' });
      fetch('/api/me/crypto', { cache: 'no-store', signal: abort.signal })
        .then(async (r) => {
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
    [session.status],
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
    <CitizenContext.Provider value={{ session, balance, access, refresh: () => load(true) }}>
      {children}
    </CitizenContext.Provider>
  );
}
