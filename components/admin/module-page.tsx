import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminModules, adminPath } from '@/lib/admin/modules';
import { adminLists, formatCell, type AdminListConfig } from '@/lib/admin/lists';
import { pageAccess } from '@/lib/permissions/guards';
import { listQuerySchema, type ListQuery } from '@/lib/api/modules/pending';
import { SuburbioApiClient } from '@/lib/api/client';
import { safeError } from '@/lib/api/errors';
import { AccessUnavailable, ErrorState, GapState } from './states';

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
  const list = adminLists[slug];
  return (
    <>
      <div className="admin-title">
        <span className="admin-kicker">GESTÃO / {module.title.toUpperCase()}</span>
        <h1>{module.title}</h1>
        <p>{module.description}</p>
      </div>
      {list?.filters && (
        <form className="admin-filter" method="get">
          <label>
            Buscar
            <input
              name="q"
              maxLength={100}
              defaultValue={query.success ? query.data.q : ''}
              placeholder={list.searchHint}
            />
          </label>
          {list.statusHint && (
            <label>
              Status
              <input
                name="status"
                maxLength={40}
                defaultValue={query.success ? query.data.status : ''}
                placeholder={list.statusHint}
              />
            </label>
          )}
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
      {!query.success ? (
        <p className="admin-warning" role="alert">
          Filtros inválidos. Use datas válidas (início antes do fim) e página positiva.
        </p>
      ) : list ? (
        <DataList slug={slug} title={module.title} config={list} actor={admin.discordId} query={query.data} />
      ) : (
        <div className="admin-panel">
          <div className="admin-panel-title">
            <h2>{module.title}</h2>
          </div>
          <GapState
            title="Sem dados para exibir"
            description="A Subúrbio API ainda não guarda configurações editáveis pelo Admin. Nada é inventado aqui."
          />
        </div>
      )}
      {slug === 'settings' && <p className="admin-note">Nenhum segredo é exibido ou armazenado no navegador.</p>}
    </>
  );
}

function pageHref(slug: string, query: ListQuery, page: number) {
  const params = new URLSearchParams();
  for (const key of ['q', 'status', 'from', 'to'] as const) if (query[key]) params.set(key, query[key]);
  params.set('page', String(page));
  return `${adminPath(slug)}?${params}`;
}

export async function DataList({
  slug,
  title,
  config,
  actor,
  query,
}: {
  slug: string;
  title: string;
  config: AdminListConfig;
  actor: string;
  query: ListQuery;
}) {
  let data;
  try {
    data = (await new SuburbioApiClient().adminList(actor, config.kind, query)).data;
  } catch (error) {
    const e = safeError(error);
    return <ErrorState message={e.body.error.message} reference={e.body.error.reference} />;
  }
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <div className="admin-panel">
      <div className="admin-panel-title">
        <h2>{title}</h2>
        <span className="admin-badge">
          {data.total} {data.total === 1 ? 'registro' : 'registros'}
        </span>
      </div>
      {data.items.length === 0 ? (
        <p className="admin-empty">{config.empty}</p>
      ) : (
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                {config.columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((row, index) => (
                <tr key={String(row.id ?? index)}>
                  {config.columns.map((c) => (
                    <td key={c.key} title={c.format === 'id' && row[c.key] ? String(row[c.key]) : undefined}>
                      {formatCell(row, c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="admin-pagination">
          <span>
            Página {data.page} de {pages}
          </span>
          {data.page > 1 ? (
            <Link className="button small outline" href={pageHref(slug, query, data.page - 1)}>
              Anterior
            </Link>
          ) : (
            <button className="button small outline" disabled>
              Anterior
            </button>
          )}
          {data.page < pages ? (
            <Link className="button small outline" href={pageHref(slug, query, data.page + 1)}>
              Próxima
            </Link>
          ) : (
            <button className="button small outline" disabled>
              Próxima
            </button>
          )}
        </div>
      )}
      <p className="admin-trace">
        Consultado em {formatCell({ at: data.asOf }, { key: 'at', label: '', format: 'date' })}
      </p>
    </div>
  );
}
