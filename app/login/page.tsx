import Link from 'next/link';
import { Crown, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { serverEnv } from '@/lib/server/env';
import { loginDiscord } from '@/lib/auth/actions';
import { safeReturnTo } from '@/lib/server/security';
import '../admin/admin.css';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Entrar — Subúrbio RP', robots: { index: false, follow: false } };
export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const enabled = serverEnv().AUTH_ENABLED;
  return <main className="admin-root auth-page"><section className="auth-brand-panel"><Link href="/" className="brand"><Crown/><span>SUBÚRBIO<small>ROLEPLAY</small></span></Link><div><span className="admin-kicker">SUA IDENTIDADE. SEU ESPAÇO.</span><h1>O seu próximo<br/>capítulo começa<br/><span>aqui.</span></h1></div><p>Da quebrada pro mundo.</p></section><section className="auth-form-panel"><ShieldCheck size={30}/><span className="admin-kicker">ACESSO SEGURO</span><h2>Entre no Subúrbio.</h2><p>Use sua conta Discord para acessar sua conta e continuar.</p>{params.error && <p className="admin-warning" role="alert">Não foi possível concluir o login. Tente novamente ou fale com a equipe.</p>}<form action={loginDiscord}><input type="hidden" name="returnTo" value={safeReturnTo(params.returnTo)}/><button className="button full" disabled={!enabled}>Entrar com Discord <ArrowUpRight size={18}/></button></form>{!enabled && <p className="admin-note" role="status">O login com Discord estará disponível em breve.</p>}<p className="auth-privacy">Solicitamos apenas sua identificação básica no Discord. Sua senha nunca passa pelo site.</p><Link href="/" className="auth-back">← Voltar para a cidade</Link></section></main>;
}
