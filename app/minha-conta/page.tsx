import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentSession } from '@/lib/auth/session';
import { logout } from '@/lib/auth/actions';
import '../admin/admin.css';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Minha conta — Subúrbio RP', robots: { index: false, follow: false } };
export default async function Account() {
  const session = await currentSession();
  if (!session) redirect('/login?returnTo=/minha-conta');
  return <main className="admin-root account-page"><header><Link href="/" className="admin-kicker">SUBÚRBIO RP</Link><form action={logout}><button className="button outline small">Sair da conta</button></form></header><div className="admin-title"><span className="admin-kicker">ÁREA DO CIDADÃO</span><h1>Salve, {session.user.name ?? 'cidadão'}.</h1><p>Discord: {session.user.discordId}</p></div><p><Link href="/minha-conta/pedidos" className="button outline">Acompanhar meus pedidos →</Link> <Link href="/minha-conta/beneficios" className="button outline">Benefícios ativos e histórico →</Link></p><div className="account-grid">{['Perfil da cidade', 'VIP', 'Personagens'].map(label => <article className="admin-panel" key={label}><div className="admin-panel-title"><h2>{label}</h2></div><p className="admin-note">As informações da sua conta estarão disponíveis em breve.</p></article>)}</div><Link href="/admin" className="auth-back">Acesso administrativo →</Link></main>;
}
