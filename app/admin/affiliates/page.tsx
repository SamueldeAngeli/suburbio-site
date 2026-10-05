import Link from 'next/link';
import { pageAccess } from '@/lib/permissions/guards';
import { can } from '@/lib/permissions/policy';
import { SuburbioApiClient } from '@/lib/api/client';
import { AccessUnavailable, ErrorState } from '@/components/admin/states';
import { safeError } from '@/lib/api/errors';
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const admin = await pageAccess('AFFILIATES_READ', '/admin/affiliates');
  if (!admin) return <AccessUnavailable />;
  let data;
  try {
    data = (await new SuburbioApiClient().affiliates(admin.discordId, Number((await searchParams).page ?? 1))).data;
  } catch (e) {
    return <ErrorState message={safeError(e).body.error.message} />;
  }
  return (
    <>
      <div className="admin-title">
        <span className="admin-kicker">PARCERIAS / AFILIADOS</span>
        <h1>Afiliados</h1>
        <p>Cupons próprios, desconto e comissão configurados separadamente.</p>
      </div>
      {can(admin, 'AFFILIATES_MANAGE') && !admin.readOnly && (
        <Link className="button small" href="/admin/affiliates/new">
          Cadastrar afiliado
        </Link>
      )}
      <div className="admin-panel">
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                {['Afiliado', 'Tipo', 'Cupom', 'Desconto', 'Comissão', 'Status'].map((t) => (
                  <th key={t}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link href={'/admin/affiliates/' + a.id}>{a.name}</Link>
                  </td>
                  <td>{a.type}</td>
                  <td>{a.code}</td>
                  <td>{a.discountPercent}%</td>
                  <td>{a.commissionPercent}%</td>
                  <td>{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.items.length && <p className="admin-empty">Nenhum afiliado cadastrado.</p>}
        <div className="admin-pagination">
          {data.page > 1 && <Link href={'?page=' + (data.page - 1)}>Anterior</Link>}
          <span>Página {data.page}</span>
          {data.page * data.pageSize < data.total && <Link href={'?page=' + (data.page + 1)}>Próxima</Link>}
        </div>
      </div>
    </>
  );
}
