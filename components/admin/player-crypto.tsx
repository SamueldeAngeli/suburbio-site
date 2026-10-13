import Link from 'next/link';
import { SuburbioApiClient } from '@/lib/api/client';
import { safeError } from '@/lib/api/errors';
import { formatCrypto } from '@/lib/api/citizen-contracts';
import { ErrorState } from './states';

const typeLabel = {
  PURCHASE_CREDIT: 'Compra de Crypto',
  GIFT_CREDIT: 'Presente recebido',
  ADMIN_CREDIT: 'Crédito administrativo',
  ADMIN_DEBIT: 'Débito administrativo',
  PURCHASE_DEBIT: 'Compra com Crypto',
  PURCHASE_REFUND: 'Estorno de compra',
  FULFILLMENT_COMPENSATION: 'Compensação de entrega',
} as const;
const originLabel = {
  site: 'Site',
  'in-game': 'In-game',
  admin: 'Admin',
  refund: 'Estorno',
  gift: 'Presente',
} as const;

// Wallet única da API (saldo, totais por tipo e ledger). A API exige PLAYERS_READ + PAYMENTS_READ.
export async function PlayerCrypto({
  discordId,
  playerId,
  page,
}: {
  discordId: string;
  playerId: string;
  page: number;
}) {
  let data;
  try {
    data = (await new SuburbioApiClient().playerCrypto(discordId, playerId, page)).data;
  } catch (error) {
    const e = safeError(error).body.error;
    return <ErrorState message={e.message} reference={e.reference} />;
  }
  const url = (p: number) => `?${new URLSearchParams({ tab: 'Crypto', page: String(p) })}`;
  const t = data.totals;
  return (
    <>
      <h2>Crypto</h2>
      <div className="admin-metrics">
        {[
          ['Saldo atual', data.balance],
          ['Comprado', t.purchased],
          ['Gasto', t.spent],
          ['Presentes recebidos', t.gifted],
          ['Créditos admin', t.adminCredited],
          ['Débitos admin', t.adminDebited],
          ['Estornos', t.refunded],
        ].map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{formatCrypto(value!)}</strong>
          </article>
        ))}
      </div>
      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Quantidade</th>
              <th>Saldo anterior</th>
              <th>Saldo posterior</th>
              <th>Origem</th>
              <th>Referência</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((m) => (
              <tr key={m.id}>
                <td>{new Date(m.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
                <td>{typeLabel[m.type]}</td>
                <td>
                  {m.direction === 'debit' ? '−' : '+'}
                  {formatCrypto(m.amount)}
                </td>
                <td>{formatCrypto(m.balanceBefore)}</td>
                <td>{formatCrypto(m.balanceAfter)}</td>
                <td>{originLabel[m.origin]}</td>
                <td>
                  {m.reference.orderId
                    ? `Pedido ${m.reference.orderId.slice(0, 8)}`
                    : `Operação ${m.reference.operationId.slice(0, 8)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.items.length === 0 && <p className="admin-empty">Nenhuma movimentação de Crypto.</p>}
      <div className="admin-pagination">
        {page > 1 && <Link href={url(page - 1)}>← Anterior</Link>}
        <span>{data.total} movimentações</span>
        {page * data.pageSize < data.total && <Link href={url(page + 1)}>Próxima →</Link>}
      </div>
    </>
  );
}
