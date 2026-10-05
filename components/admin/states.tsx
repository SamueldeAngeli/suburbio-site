import Link from 'next/link';
import { CircleDashed, LockKeyhole, RefreshCw } from 'lucide-react';
export function GapState({
  title = 'Dados ainda não integrados',
  description = 'Este módulo aguarda a integração oficial. Nenhum dado demonstrativo é exibido aqui.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section className="admin-empty" role="status">
      <CircleDashed size={36} strokeWidth={1.2} />
      <span className="admin-kicker">INTEGRAÇÃO PENDENTE</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  );
}
export function AccessUnavailable() {
  return (
    <section className="admin-gate">
      <LockKeyhole size={38} />
      <span className="admin-kicker">ACESSO INSTITUCIONAL</span>
      <h1>Aguardando autorização da API.</h1>
      <p>
        Seu login Discord identifica você. A confirmação de acesso administrativo ainda depende da integração com a
        Subúrbio API.
      </p>
      <p>Nenhuma permissão é concedida automaticamente.</p>
      <Link href="/minha-conta" className="button outline">
        Ir para minha conta
      </Link>
    </section>
  );
}
export function ErrorState({
  message = 'Não foi possível carregar os dados.',
  reference,
}: {
  message?: string;
  reference?: string;
}) {
  return (
    <section className="admin-empty" role="alert">
      <RefreshCw size={32} />
      <h2>{message}</h2>
      {reference && <p>Código: {reference}</p>}
      <p>Tente novamente em instantes. O site público continua disponível.</p>
    </section>
  );
}
export function PanelSkeleton() {
  return (
    <div className="admin-skeleton" role="status" aria-label="Carregando módulo">
      <span />
      <span />
      <span />
      <p>Carregando informações…</p>
    </div>
  );
}
