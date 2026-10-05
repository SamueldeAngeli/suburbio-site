import Link from 'next/link';
export default function Forbidden() {
  return (
    <main className="section">
      <span className="eyebrow">403 / ACESSO RESTRITO</span>
      <h1 style={{ fontSize: 'clamp(36px, 7vw, 72px)', width: 'auto' }}>Acesso não autorizado.</h1>
      <p>Sua conta não possui a permissão necessária para esta área.</p>
      <Link href="/minha-conta" className="button">
        Ir para minha conta
      </Link>
    </main>
  );
}
