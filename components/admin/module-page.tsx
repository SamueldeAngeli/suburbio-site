import { notFound } from 'next/navigation';
import { adminModules, adminPath } from '@/lib/admin/modules';
import { pageAccess } from '@/lib/permissions/guards';
import { listQuerySchema } from '@/lib/api/modules/pending';
import { AccessUnavailable, GapState } from './states';
export async function ModulePage({
  slug,
  searchParams,
}: {
  slug: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const module = adminModules.find((m) => m.slug === slug);
  if (!module) notFound();
  const admin = await pageAccess(module.capability, adminPath(slug));
  if (!admin) return <AccessUnavailable />;
  const raw = await searchParams;
  const query = listQuerySchema.safeParse(
    Object.fromEntries(
      Object.entries(raw).filter(([key]) => ['q', 'page', 'pageSize', 'status', 'from', 'to'].includes(key)),
    ),
  );
  return (
    <>
      <div className="admin-title">
        <span className="admin-kicker">GESTÃO / {module.title.toUpperCase()}</span>
        <h1>{module.title}</h1>
        <p>{module.description}</p>
      </div>
      {module.filters.length > 0 && (
        <form className="admin-filter" method="get">
          <label>
            Buscar
            <input
              name="q"
              maxLength={100}
              defaultValue={query.success ? query.data.q : ''}
              placeholder={module.filters[0]}
            />
          </label>
          <label>
            Status
            <input
              name="status"
              maxLength={40}
              defaultValue={query.success ? query.data.status : ''}
              placeholder="Todos"
            />
          </label>
          <label>
            De
            <input type="date" name="from" defaultValue={query.success ? query.data.from : ''} />
          </label>
          <label>
            Até
            <input type="date" name="to" defaultValue={query.success ? query.data.to : ''} />
          </label>
          <input type="hidden" name="page" value="1" />
          <button className="button small">Aplicar filtros</button>
        </form>
      )}
      {!query.success && (
        <p className="admin-warning" role="alert">
          Filtros inválidos. Use datas válidas, página positiva e até 100 registros por página.
        </p>
      )}
      <div className="admin-panel">
        <div className="admin-panel-title">
          <h2>{module.title}</h2>
          <span className="admin-badge">Aguardando integração</span>
        </div>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                {module.columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
          </table>
        </div>
        <GapState />
        <div className="admin-pagination">
          <span>Paginação pelo servidor · disponível após integração</span>
          <button disabled>Anterior</button>
          <button disabled>Próxima</button>
        </div>
      </div>
      {['permissions', 'refunds', 'chargebacks'].includes(slug) && (
        <p className="admin-note">
          Ações críticas exigirão confirmação, motivo, autorização e auditoria da API. Nenhuma alteração está habilitada
          nesta etapa.
        </p>
      )}
      {slug === 'settings' && <p className="admin-note">Nenhum segredo é exibido ou armazenado no navegador.</p>}
    </>
  );
}
