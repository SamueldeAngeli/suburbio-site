'use client';
import { useEffect, useRef, useState, useId } from 'react';
import Link from 'next/link';
import { ChevronDown, UserRound, LogOut, ArrowUpRight, Handshake, ShieldCheck } from 'lucide-react';
import { loginDiscord, logout } from '@/lib/auth/actions';
import type { PublicProfile } from '@/lib/public-profile';
import { useCitizen, CitizenProvider } from './citizen-provider';
import { Avatar } from './avatar';
import { DiscordIcon } from './discord-icon';
export type UserState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; user: PublicProfile };
export function UserNav() {
  const context = useCitizen();
  return context ? (
    <ConnectedUserNav />
  ) : (
    <CitizenProvider>
      <ConnectedUserNav />
    </CitizenProvider>
  );
}
function ConnectedUserNav() {
  const data = useCitizen()!;
  const [returnTo, setReturnTo] = useState('/minha-conta');
  useEffect(() => {
    setReturnTo(new URLSearchParams(window.location.search).get('returnTo') || '/minha-conta');
  }, []);
  return <UserMenu state={data.session} returnTo={returnTo} access={data.access} />;
}
export function UserMenu({
  state,
  returnTo = '/minha-conta',
  access,
}: {
  state: UserState;
  returnTo?: string;
  access?: { affiliate: boolean; admin: boolean };
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = (focus = false) => {
    setOpen(false);
    if (focus) trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  if (state.status === 'loading')
    return (
      <div className="user-loading" role="status" aria-label="Carregando sua conta">
        <span />
        <i />
      </div>
    );
  if (state.status === 'error')
    return (
      <Link className="user-login" href="/login">
        Acessar minha conta <ArrowUpRight size={16} />
      </Link>
    );
  if (state.status === 'unauthenticated')
    return (
      <form action={loginDiscord} className="user-login-form">
        <input type="hidden" name="returnTo" value={returnTo} />
        <button className="user-login">
          <DiscordIcon />
          <span>Entrar com Discord</span>
          <ArrowUpRight size={15} />
        </button>
      </form>
    );
  const user = state.user;
  return (
    <div
      className="user-nav"
      ref={root}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          close(true);
        }
        if (open && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
          e.preventDefault();
          const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
          const index = items.indexOf(document.activeElement as HTMLElement);
          items[
            e.key === 'Home'
              ? 0
              : e.key === 'End'
                ? items.length - 1
                : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
          ]?.focus();
        }
      }}
    >
      <button
        className="user-trigger"
        ref={trigger}
        aria-label={`Conta de ${user.name}`}
        title={user.name}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={id}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (!open && ['ArrowDown', 'ArrowUp'].includes(e.key)) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <Avatar name={user.name} image={user.image} />
        <span>{user.name}</span>
        <ChevronDown size={15} className={open ? 'rotated' : ''} />
      </button>
      {open && (
        <div className="user-dropdown" id={id} ref={menu} role="menu" aria-label="Sua conta">
          <div className="user-dropdown-identity">
            <Avatar name={user.name} image={user.image} size={42} />
            <div>
              <strong>{user.name}</strong>
              {user.username && <small>@{user.username}</small>}
            </div>
          </div>
          <Link href="/minha-conta" role="menuitem" onClick={() => close()}>
            <UserRound size={17} />
            Ver perfil
            <ArrowUpRight size={14} />
          </Link>
          {access?.affiliate && (
            <Link href="/minha-conta/afiliado" role="menuitem" onClick={() => close()}>
              <Handshake size={17} />
              Afiliado
              <ArrowUpRight size={14} />
            </Link>
          )}
          {access?.admin && (
            <Link href="/admin" role="menuitem" onClick={() => close()}>
              <ShieldCheck size={17} />
              Admin
              <ArrowUpRight size={14} />
            </Link>
          )}
          <form action={logout}>
            <button role="menuitem">
              <LogOut size={17} />
              Sair
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
