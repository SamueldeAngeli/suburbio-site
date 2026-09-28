import Link from 'next/link';

// O contrato de pedidos ainda não fornece os registros destas etapas.
// Não inferir pagamento, entrega ou notificação a partir de order.status.
export function OrderStages({ admin = false, stage }: { admin?: boolean; stage?: string }) {
  return <div className="account-grid">
    {['Pagamento', 'Entrega', admin ? 'Benefício / Entitlement' : 'Benefício', 'Notificação Discord'].filter(title => !stage || title === stage).map(title =>
      <section className="admin-panel" key={title} aria-label={title}>
        <h2>{title}</h2>
        <p>{admin ? 'O contrato atual da API não fornece os dados desta etapa por pedido.' : 'Os detalhes desta etapa ainda não estão disponíveis para este pedido.'}</p>
        {title === 'Benefício' && <Link href="/minha-conta/beneficios">Consultar meus benefícios →</Link>}
      </section>
    )}
  </div>;
}
