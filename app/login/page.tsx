import { Crown, ShieldCheck, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import '../admin/admin.css';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Entrar — Subúrbio RP', robots: { index: false, follow: false } };
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <main className="admin-root auth-page">
      <section className="auth-brand-panel">
        <div className="brand">
          <Crown />
          <span>
            SUBÚRBIO<small>ROLEPLAY</small>
          </span>
        </div>
        <div>
          <span className="admin-kicker">SUA IDENTIDADE. SEU ESPAÇO.</span>
          <h1>
            Seu próximo
            <br />
            capítulo começa
            <br />
            <span>aqui.</span>
          </h1>
        </div>
        <p>Da quebrada pro mundo.</p>
      </section>
      <section className="auth-form-panel">
        <ShieldCheck size={30} />
        <span className="admin-kicker">ACESSO SEGURO</span>
        <h2>Entre no Subúrbio.</h2>
        <p>
          {params.returnTo === '/tela'
            ? 'Entre com Discord para criar ou participar de uma transmissão.'
            : 'Use sua conta Discord para acessar seu perfil e acompanhar seus benefícios.'}
        </p>
        {params.error && (
          <p className="admin-warning" role="alert">
            Não foi possível concluir o login. Tente novamente em Entrar com Discord no topo da página.
          </p>
        )}
        <div className="citizen-auth-hint">
          Para começar, use “Entrar com Discord” na barra superior.
          <ArrowUpRight size={20} />
        </div>
        <p className="auth-privacy">
          Solicitamos sua identificação básica e participação no servidor da Subúrbio no Discord. Sua senha nunca passa
          pelo site.
        </p>
        <Link href="/" className="auth-back">
          ← Voltar para a cidade
        </Link>
      </section>
    </main>
  );
}
