'use client';
export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="admin-root admin-gate" role="alert"><span className="admin-kicker">INDISPONIBILIDADE TEMPORÁRIA</span><h1>Não foi possível carregar o painel.</h1><p>O site público continua disponível. Tente novamente em instantes.</p><button className="button" onClick={reset}>Tentar novamente</button><a href="/" className="button outline">Voltar ao site</a></section>;
}
