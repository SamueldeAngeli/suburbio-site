'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Crown,
  LayoutDashboard,
  Users,
  ShieldCheck,
  KeyRound,
  ListChecks,
  Ban,
  ShoppingBag,
  CreditCard,
  RotateCcw,
  TriangleAlert,
  ScrollText,
  MessageCircle,
  Server,
  Settings,
  LogOut,
  ArrowUpRight,
  Menu,
  X,
} from 'lucide-react';
import { logout } from '@/lib/auth/actions';
import { adminPath, type AdminModule } from '@/lib/admin/modules';
const icons = [
  LayoutDashboard,
  Users,
  ShieldCheck,
  KeyRound,
  ListChecks,
  Ban,
  ShoppingBag,
  CreditCard,
  RotateCcw,
  TriangleAlert,
  ScrollText,
  MessageCircle,
  Server,
  Settings,
];
export function AdminShell({
  children,
  modules,
  name,
  owner,
}: {
  children: React.ReactNode;
  modules: (AdminModule & { iconIndex: number })[];
  name: string;
  owner: boolean;
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const current =
    modules.find((m) => adminPath(m.slug) === path) ??
    modules.find((m) => m.slug && path.startsWith(`${adminPath(m.slug)}/`));
  const navigation = (
    <nav aria-label="Módulos administrativos">
      {modules.map((m) => {
        const Icon = icons[m.iconIndex] ?? ShoppingBag;
        const active = m.slug ? path.startsWith(adminPath(m.slug)) : path === '/admin';
        return (
          <Link
            href={adminPath(m.slug)}
            key={m.slug}
            aria-current={active ? 'page' : undefined}
            onClick={() => setOpen(false)}
          >
            <Icon size={18} />
            <span>{m.title}</span>
          </Link>
        );
      })}
    </nav>
  );
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/" className="brand">
          <Crown />
          <span>
            SUBÚRBIO<small>CONTROL CENTER</small>
          </span>
        </Link>
        <span className="admin-kicker">GESTÃO DA CIDADE</span>
        {navigation}
        <Link href="/" className="admin-back">
          Visitar o site <ArrowUpRight size={16} />
        </Link>
      </aside>
      <div className="admin-workspace">
        <header className="admin-header">
          <div>
            <button
              className="admin-mobile-toggle"
              aria-label="Abrir navegação"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </button>
            <span className="admin-breadcrumb">
              Administração <span>/</span> {current?.title ?? 'Detalhes'}
            </span>
          </div>
          <div className="admin-identity">
            <span>
              {name}
              {owner && <small>SYSTEM_OWNER</small>}
            </span>
            <form action={logout}>
              <button aria-label="Sair da conta">
                <LogOut size={18} />
              </button>
            </form>
          </div>
        </header>
        {open && <div className="admin-mobile-nav">{navigation}</div>}
        <div className="admin-content">{children}</div>
        <footer className="admin-foot">
          SUBÚRBIO RP <span>Administração institucional · acesso protegido</span>
        </footer>
      </div>
    </div>
  );
}
