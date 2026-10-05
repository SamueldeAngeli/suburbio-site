import { commerceAmount } from '@/lib/commerce-amount';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentSession } from '@/lib/auth/session';
import { SuburbioApiClient } from '@/lib/api/client';
import { safeError } from '@/lib/api/errors';
import { orderStatusLabel } from '@/lib/api/order-contracts';
import { EmptyState } from '@/components/account/empty-state';
import '../../admin/admin.css';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Meus pedidos — Subúrbio RP', robots: { index: false, follow: false } };
export default async function Orders({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await currentSession();
  if (!session) redirect('/login?returnTo=/minha-conta/pedidos');
  const query = await searchParams,
    page = Number(query.page ?? 1);
  let data, error;
  try {
    data = (await new SuburbioApiClient().orders(session.user.discordId, page)).data;
  } catch (e) {
    error = safeError(e).body.error;
  }
  return (
    <main className="admin-root account-page">
      <div className="admin-title">
        <h1>Meus pedidos</h1>
        <p>Do primeiro passo à entrega. Acompanhe cada etapa por aqui.</p>
      </div>
      {error ? (
        <section className="citizen-card">
          <EmptyState
            title="Não conseguimos consultar seus pedidos."
            description="Tente novamente em instantes. Seus registros permanecem na sua conta."
            href="/minha-conta/pedidos"
            label="Tentar novamente"
          />
        </section>
      ) : (
        data && (
          <section className="citizen-card">
            {data.items.length === 0 ? (
              <EmptyState
                title="Você ainda não possui pedidos."
                description="Conheça os planos e benefícios disponíveis para a sua história."
                href="/#loja"
                label="Ver Área VIP"
              />
            ) : (
              <table className="citizen-orders">
                <thead>
                  <tr>
                    <th>PEDIDO</th>
                    <th>DATA</th>
                    <th>STATUS</th>
                    <th>VALOR</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link href={`/minha-conta/pedidos/${order.id}`}>#{order.id.slice(0, 8)}</Link>
                        <small>Produtos no detalhe do pedido</small>
                      </td>
                      <td>
                        {new Date(order.createdAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                      </td>
                      <td>
                        <span className="citizen-badge" data-status={order.status}>
                          {orderStatusLabel[order.status]}
                        </span>
                      </td>
                      <td>{commerceAmount(order.netAmountMinor, order.currency)}</td>
                      <td>
                        <Link href={`/minha-conta/pedidos/${order.id}`}>Ver pedido ↗</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="admin-pagination">
              {page > 1 && <Link href={`?page=${page - 1}`}>← Anterior</Link>}
              <span>{data.total} pedido(s)</span>
              {page * data.pageSize < data.total && <Link href={`?page=${page + 1}`}>Próxima →</Link>}
            </div>
          </section>
        )
      )}
    </main>
  );
}
