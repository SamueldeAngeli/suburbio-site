import Link from 'next/link';
import { pageAccess } from '@/lib/permissions/guards';
import { SuburbioApiClient } from '@/lib/api/client';
import { safeError } from '@/lib/api/errors';
import { AccessUnavailable, ErrorState } from '@/components/admin/states';
const money = (v: string) => (Number(v) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const admin = await pageAccess('COUPONS_READ', '/admin/coupons');
  if (!admin) return <AccessUnavailable />;
  let result;
  const page = Number((await searchParams).page ?? 1);
  try {
    result = (await new SuburbioApiClient().coupons(admin.discordId, page)).data;
  } catch (error) {
    const e = safeError(error);
    return <ErrorState message={e.body.error.message} />;
  }
  return (
    <>
      <div className="admin-title">
        <span className="admin-kicker">GESTÃO / CUPONS</span>
        <h1>Cupons de desconto</h1>
        <p>Regras de apoio à cidade e desempenho comercial.</p>
      </div>
      {admin.fullAccess && !admin.readOnly && (
        <Link className="button small" href="/admin/coupons/new">
          Novo cupom
        </Link>
      )}
      <div className="admin-panel">
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Desconto</th>
                <th>Usos</th>
                <th>Valor bruto</th>
                <th>Desconto concedido</th>
                <th>Vendas líquidas</th>
                <th>Status</th>
                <th>Validade</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/admin/coupons/${c.id}`}>{c.code}</Link>
                  </td>
                  <td>{c.discountType === 'percentage' ? `${c.discountValue}%` : money(String(c.discountValue))}</td>
                  <td>{c.metrics.usesCount}</td>
                  <td>{money(c.metrics.grossSalesMinor)}</td>
                  <td>{money(c.metrics.discountGrantedMinor)}</td>
                  <td>{money(c.metrics.netSalesMinor)}</td>
                  <td>{c.status === 'active' ? 'Ativo' : c.status === 'inactive' ? 'Inativo' : 'Arquivado'}</td>
                  <td>
                    {c.expiresAt
                      ? new Date(c.expiresAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                      : 'Sem data final'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!result.items.length && <p className="admin-empty">Nenhum cupom cadastrado.</p>}
        <div className="admin-pagination">
          <span>Página {page}</span>
          {page > 1 && <Link href={`?page=${page - 1}`}>Anterior</Link>}
          {page * result.pageSize < result.total && <Link href={`?page=${page + 1}`}>Próxima</Link>}
        </div>
      </div>
      <p className="admin-note">
        Métricas consideram somente usos aplicados. Consultar um cupom no carrinho não registra uma venda.
      </p>
    </>
  );
}
