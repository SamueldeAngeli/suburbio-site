import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentSession } from '@/lib/auth/session';
import { SuburbioApiClient } from '@/lib/api/client';
import { safeError } from '@/lib/api/errors';
import { ErrorState } from '@/components/admin/states';
import { EmptyState } from '@/components/account/empty-state';
import { RenewalPreparation } from '@/components/commerce-preparation';
import { benefitGroup } from '@/lib/commerce-preparation';
import { entitlementStatus, remainingLabel } from '@/lib/entitlements';
import '../../admin/admin.css';
import '../benefits.css';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Meus benefícios — Subúrbio RP', robots: { index: false, follow: false } };
const tabs = { vip: 'VIP', veiculos: 'Veículos', imoveis: 'Imóveis', outros: 'Outros' };
export default async function Benefits({ searchParams }: { searchParams: Promise<{ page?: string; tab?: string }> }) {
  const session = await currentSession();
  if (!session) redirect('/login?returnTo=/minha-conta/beneficios');
  const params = await searchParams,
    page = Number(params.page ?? 1),
    tab = params.tab && params.tab in tabs ? (params.tab as keyof typeof tabs) : 'vip';
  let data, error;
  try {
    data = (await new SuburbioApiClient().entitlements(session.user.discordId, page)).data;
  } catch (e) {
    error = safeError(e).body.error;
  }
  const date = (v: string | null) =>
    v ? new Date(v).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Não informada';
  const items = data?.items.filter((e) => benefitGroup(e.type) === tab) ?? [];
  return (
    <main className="admin-root account-page">
      <Link className="admin-kicker" href="/minha-conta">
        ← MINHA CONTA
      </Link>
      <div className="admin-title">
        <span className="admin-kicker">ÁREA DO CIDADÃO</span>
        <h1>Meus benefícios</h1>
        <p>Suas conquistas, seus próximos capítulos.</p>
      </div>
      <nav className="admin-tabs" aria-label="Tipos de benefício">
        {Object.entries(tabs).map(([key, label]) => (
          <Link key={key} href={`?tab=${key}&page=${page}`} aria-current={key === tab ? 'page' : undefined}>
            {label}
          </Link>
        ))}
      </nav>
      {error ? (
        <ErrorState message={error.message} reference={error.reference} />
      ) : (
        data && (
          <>
            <p className="admin-note">
              Os filtros mostram os registros desta página. Navegue pelas páginas para consultar os demais benefícios.
              Datas no horário de Brasília.
            </p>
            <div className="benefit-grid">
              {items.map((e) => (
                <article className="admin-panel benefit-card" key={e.id}>
                  <div className="benefit-art" aria-hidden="true">
                    {tab === 'vip' ? '♛' : tab === 'veiculos' ? '↗' : tab === 'imoveis' ? '⌂' : '✦'}
                  </div>
                  <span className="admin-kicker">{entitlementStatus[e.status]}</span>
                  <h2>{e.productName}</h2>
                  <dl>
                    <dt>Ativado em</dt>
                    <dd>{date(e.startsAt)}</dd>
                    <dt>Expira em</dt>
                    <dd>
                      {e.expiresAt ? date(e.expiresAt) : e.status === 'PENDING' ? 'Após ativação' : 'Sem vencimento'}
                    </dd>
                    <dt>Tempo restante</dt>
                    <dd>{remainingLabel(e.status, e.expiresAt, data.asOf)}</dd>
                    <dt>Duração adquirida</dt>
                    <dd>Consulte o pedido de origem</dd>
                  </dl>
                  <Link href={`/minha-conta/pedidos/${e.orderId}`}>Ver pedido →</Link>
                  {(tab === 'veiculos' || tab === 'imoveis') && <RenewalPreparation entitlementId={e.id} />}
                </article>
              ))}
            </div>
            {items.length === 0 && (
              <EmptyState
                title="Nenhum benefício nesta categoria."
                description="Os benefícios desta página aparecerão aqui após o registro."
                href="/#loja"
                label="Conhecer benefícios VIP"
              />
            )}
            <div className="admin-pagination">
              {page > 1 && <Link href={`?tab=${tab}&page=${page - 1}`}>← Anterior</Link>}
              <span>
                Página {data.page} · {data.total} benefícios no total
              </span>
              {page * data.pageSize < data.total && <Link href={`?tab=${tab}&page=${page + 1}`}>Próxima →</Link>}
            </div>
          </>
        )
      )}
    </main>
  );
}
