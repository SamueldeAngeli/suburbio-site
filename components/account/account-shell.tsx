'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, LayoutDashboard, ShoppingBag, Crown, Gift, Users, ShieldCheck } from 'lucide-react';
import { Avatar } from '@/components/site/avatar';
import type { PublicProfile } from '@/lib/public-profile';
const links = [
  { href: '/minha-conta', label: 'Visão geral', icon: LayoutDashboard },
  { href: '/minha-conta/pedidos', label: 'Pedidos', icon: ShoppingBag },
  { href: '/minha-conta/beneficios', label: 'Benefícios', icon: Crown },
  { href: '/minha-conta/presentes', label: 'Presentes', icon: Gift },
  { href: '/minha-conta/personagens', label: 'Personagens', icon: Users },
];
export function AccountShell({ user, children }: { user: PublicProfile; children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="citizen-page">
      <div className="citizen-heading">
        <div>
          <span className="citizen-kicker">SEU ESPAÇO NA CIDADE</span>
          <h1>
            Área do cidadão<span>.</span>
          </h1>
        </div>
        <Link href="/#loja">
          Explore a Área VIP <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="citizen-layout">
        <aside className="citizen-sidebar">
          <div className="citizen-profile">
            <div className="citizen-profile-cover" />
            <Avatar name={user.name} image={user.image} size={88} />
            <h2 title={user.name}>{user.name}</h2>
            {user.username && <p className="citizen-username">@{user.username}</p>}
            <span className="citizen-profile-note">
              <ShieldCheck size={13} />
              Conta conectada com Discord
            </span>
          </div>
          <nav className="citizen-tabs" aria-label="Área do cidadão">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={
                  path === href || (href !== '/minha-conta' && path.startsWith(href + '/')) ? 'page' : undefined
                }
              >
                <Icon size={17} />
                <span>{label}</span>
                <ArrowUpRight size={13} />
              </Link>
            ))}
          </nav>
          <div className="citizen-sidebar-foot">
            <span>SUBÚRBIO ROLEPLAY</span>
            <p>Sua história continua aqui.</p>
          </div>
        </aside>
        <div className="citizen-content">{children}</div>
      </div>
      <div className="citizen-footer">
        <span>SUBÚRBIO RP</span>
        <p>Da quebrada pro mundo.</p>
        <Link href="/">
          Voltar para a cidade <ArrowUpRight size={14} />
        </Link>
      </div>
    </div>
  );
}
