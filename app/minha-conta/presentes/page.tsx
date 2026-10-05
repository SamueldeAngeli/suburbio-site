import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentSession } from '@/lib/auth/session';
import { SuburbioApiClient } from '@/lib/api/client';
import { EmptyState } from '@/components/account/empty-state';
import '../../admin/admin.css';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Meus presentes — Subúrbio RP', robots: { index: false, follow: false } };
export default async function Gifts({ searchParams }: { searchParams: Promise<{ tab?: string; page?: string }> }) {
  const session = await currentSession();
  if (!session) redirect('/login?returnTo=/minha-conta/presentes');
  const query = await searchParams,
    tab = query.tab === 'enviados' ? 'enviados' : 'recebidos',
    page = Number(query.page ?? 1);
  let data,
    error = false;
  try {
    data = (await new SuburbioApiClient().gifts(session.user.discordId, tab === 'enviados' ? 'sent' : 'received', page))
      .data;
  } catch {
    error = true;
  }
  return (
    <main className="admin-root account-page">
      <div className="admin-title">
        <h1>Meus presentes</h1>
        <p>Boas histórias ficam melhores quando compartilhadas.</p>
      </div>
      <nav className="citizen-gift-tabs" aria-label="Histórico de presentes">
        <Link href="?tab=recebidos" aria-current={tab === 'recebidos' ? 'page' : undefined}>
          Recebidos
        </Link>
        <Link href="?tab=enviados" aria-current={tab === 'enviados' ? 'page' : undefined}>
          Enviados
        </Link>
      </nav>
      <section className="citizen-card">
        {error ? (
          <EmptyState title="Não conseguimos consultar seus presentes." description="Tente novamente em instantes." />
        ) : data?.items.length ? (
          <>
            {data.items.map((gift) => (
              <article key={gift.id} className="admin-panel">
                <p>
                  {new Date(gift.createdAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} ·{' '}
                  {gift.status === 'delivered'
                    ? 'Entregue'
                    : gift.paymentStatus === 'approved'
                      ? 'Aguardando entrega'
                      : 'Aguardando confirmação'}
                </p>
                {gift.products.map((product, index) => (
                  <p key={index}>
                    {product.quantity} × {product.name} ·{' '}
                    {product.validityMode === 'DURATION' ? product.durationDays + ' dias' : 'Permanente'}
                  </p>
                ))}
                {gift.entitlements.map((e) => (
                  <p key={e.id}>
                    Benefício:{' '}
                    {e.status === 'ACTIVE'
                      ? 'Ativo'
                      : e.status === 'PENDING'
                        ? 'Aguardando ativação'
                        : e.status === 'EXPIRED'
                          ? 'Expirado'
                          : 'Encerrado'}
                    {e.expiresAt ? ' · Expira em ' + new Date(e.expiresAt).toLocaleDateString('pt-BR') : ''}
                  </p>
                ))}
                <p>
                  {tab === 'enviados'
                    ? 'Para ' + gift.recipient.displayName
                    : gift.sender
                      ? 'De Discord ' + gift.sender.discordId
                      : 'Presente anônimo'}
                </p>
                {tab === 'enviados' && <Link href={'/minha-conta/pedidos/' + gift.id}>Ver pedido</Link>}
              </article>
            ))}
            <div className="admin-pagination">
              {page > 1 && <Link href={'?tab=' + tab + '&page=' + (page - 1)}>← Anterior</Link>}
              <span>{data.total} presente(s)</span>
              {page * data.pageSize < data.total && <Link href={'?tab=' + tab + '&page=' + (page + 1)}>Próxima →</Link>}
            </div>
          </>
        ) : (
          <EmptyState
            title={tab === 'recebidos' ? 'Você ainda não recebeu presentes.' : 'Você ainda não enviou presentes.'}
            description="Os presentes confirmados aparecerão aqui."
          />
        )}
      </section>
    </main>
  );
}
