'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Crown, ShoppingBag, Menu, X, ArrowUpRight } from 'lucide-react';
import { CryptoBalance } from './crypto-balance';
import { UserNav } from './user-nav';
import { site } from '@/lib/site';
export function SiteHeader() {
  const path = usePathname(),
    [mobile, setMobile] = useState(false),
    [count, setCount] = useState(0);
  useEffect(() => {
    const update = (event: Event) => setCount(Number((event as CustomEvent<number>).detail) || 0);
    window.addEventListener('suburbio:cart-count', update);
    return () => window.removeEventListener('suburbio:cart-count', update);
  }, []);
  return (
    <>
      <div className="announcement">
        <span>DA QUEBRADA PRO MUNDO.</span>
        <span>
          Uma cidade. Infinitas histórias. <ArrowUpRight size={13} />
        </span>
      </div>
      <header className="header site-header">
        <Link href="/" className="brand" aria-label="Subúrbio RP início">
          <Crown />
          <span>
            SUBÚRBIO<small>ROLEPLAY</small>
          </span>
        </Link>
        <nav
          id="site-navigation"
          className={mobile ? 'nav mobile-open' : 'nav'}
          aria-label="Navegação principal"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setMobile(false);
          }}
        >
          <Link href="/#cidade" onClick={() => setMobile(false)}>
            A cidade
          </Link>
          <Link href="/#experiencias" onClick={() => setMobile(false)}>
            Seu universo
          </Link>
          <Link href="/#loja" onClick={() => setMobile(false)}>
            VIP <span className="nav-new">PLANOS</span>
          </Link>
          <Link href="/#duvidas" onClick={() => setMobile(false)}>
            Dúvidas
          </Link>
          <a
            href={site.discordUrl || '/#duvidas'}
            target={site.discordUrl ? '_blank' : undefined}
            rel="noreferrer"
            onClick={() => setMobile(false)}
          >
            Nosso Discord
            <ArrowUpRight size={12} />
          </a>
          <button
            className="mobile-cart-link"
            onClick={() => {
              setMobile(false);
              if (path === '/') window.dispatchEvent(new Event('suburbio:open-cart'));
              else window.location.assign('/#loja');
            }}
          >
            Carrinho {count > 0 ? `(${count})` : ''}
          </button>
          <Link href="/tela" onClick={() => setMobile(false)}>
            Transmissão
          </Link>
          <CryptoBalance mobile />
        </nav>
        <div className="header-actions">
          <button
            className="cart-trigger"
            aria-label={`Abrir carrinho, ${count} itens`}
            onClick={() => {
              if (path === '/') window.dispatchEvent(new Event('suburbio:open-cart'));
              else window.location.assign('/?cart=open');
            }}
          >
            <ShoppingBag size={19} />
            {count > 0 && <b>{count}</b>}
          </button>
          <CryptoBalance />
          <UserNav />
          <button
            className="menu-toggle icon-button"
            aria-label={mobile ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={mobile}
            aria-controls="site-navigation"
            onClick={() => setMobile(!mobile)}
          >
            {mobile ? <X /> : <Menu />}
          </button>
        </div>
      </header>
    </>
  );
}
