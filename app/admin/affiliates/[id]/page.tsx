import { pageAccess } from '@/lib/permissions/guards';
import { can } from '@/lib/permissions/policy';
import { SuburbioApiClient } from '@/lib/api/client';
import { AccessUnavailable, ErrorState } from '@/components/admin/states';
import { safeError } from '@/lib/api/errors';
import { AffiliateEditor } from '@/components/admin/affiliate-editor';
import { AffiliatePayout } from '@/components/admin/affiliate-payout';
import { AffiliateDashboard } from '@/components/affiliate/dashboard';
import { moneyMinor } from '@/lib/format-money';
import '@/app/affiliate.css';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string; page?: string; payoutPage?: string }>;
}) {
  const { id } = await params,
    admin = await pageAccess('AFFILIATES_READ', '/admin/affiliates/' + id);
  if (!admin) return <AccessUnavailable />;
  const api = new SuburbioApiClient(),
    q = await searchParams;
  let a, d;
  try {
    [a, d] = await Promise.all([
      api.affiliate(admin.discordId, id),
      api.affiliateDashboard(admin.discordId, q.period ?? '30', Number(q.page ?? 1), id),
    ]);
  } catch (e) {
    return <ErrorState message={safeError(e).body.error.message} />;
  }
  let payouts, preview;
  try {
    if (can(admin, 'AFFILIATES_PAYOUT_READ'))
      payouts = (await api.affiliatePayouts(admin.discordId, id, Number(q.payoutPage ?? 1))).data;
    if (can(admin, 'AFFILIATES_PAYOUT_MANAGE') && !admin.readOnly)
      preview = (await api.affiliatePayoutPreview(admin.discordId, id)).data;
  } catch {}
  return (
    <>
      <AffiliateDashboard data={d.data} basePath={'/admin/affiliates/' + id} />
      {preview && <AffiliatePayout id={id} preview={preview} />}
      <section className="admin-panel">
        <h2>Repasses registrados</h2>
        {payouts ? (
          <>
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Transferido</th>
                    <th>Compensado</th>
                    <th>Responsável</th>
                    <th>Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.items.map((p) => (
                    <tr key={p.id}>
                      <td>{new Date(p.createdAt).toLocaleDateString('pt-BR')}</td>
                      <td>{moneyMinor(p.amountMinor)}</td>
                      <td>{moneyMinor(p.offsetMinor)}</td>
                      <td>{p.actorDiscordId}</td>
                      <td>{p.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!payouts.items.length && <p>Nenhum repasse registrado.</p>}
            <div className="admin-pagination">
              {payouts.page > 1 && <a href={'?payoutPage=' + (payouts.page - 1)}>Anterior</a>}
              {payouts.items.length === 25 && <a href={'?payoutPage=' + (payouts.page + 1)}>Próxima</a>}
            </div>
          </>
        ) : (
          <p>Consulta de repasses indisponível para este acesso.</p>
        )}
      </section>
      {can(admin, 'AFFILIATES_MANAGE') && !admin.readOnly && (
        <details className="admin-panel">
          <summary>Editar cadastro, cupom e percentuais</summary>
          <AffiliateEditor affiliate={a.data} />
        </details>
      )}
    </>
  );
}
