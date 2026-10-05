import Link from 'next/link';
import { z } from 'zod';
import { pageAccess } from '@/lib/permissions/guards';
import { SuburbioApiClient } from '@/lib/api/client';
import { safeError } from '@/lib/api/errors';
import { AccessUnavailable, ErrorState } from './states';
const filters = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  q: z.string().trim().max(100).default(''),
  status: z.enum(['', 'active', 'disabled']).default(''),
});
export async function AdminList({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await pageAccess('ADMINS_READ', '/admin/admins');
  if (!admin) return <AccessUnavailable />;
  const parsed = filters.safeParse(await searchParams);
  if (!parsed.success) return <ErrorState message="Filtros inválidos." />;
  const query = parsed.data;
  let result;
  try {
    result = (await new SuburbioApiClient().admins(admin.discordId, query.page, query.q, query.status)).data;
  } catch (error) {
    const safe = safeError(error);
    return <ErrorState message={safe.body.error.message} reference={safe.body.error.reference} />;
  }
  const pageUrl = (page: number) =>
    `/admin/admins?${new URLSearchParams({ page: String(page), q: query.q, status: query.status })}`;
  return (
    <>
      <div className="admin-title">
        <span className="admin-kicker">GESTÃO / ADMINISTRADORES</span>
        <h1>Administradores</h1>
        <p>Identidade institucional, acesso e responsabilidade.</p>
      </div>
      <form className="admin-filter">
        <label>
          Buscar
          <input name="q" maxLength={100} defaultValue={query.q} placeholder="AdminAccount ID ou Discord exato" />
        </label>
        <label>
          Status
          <select name="status" defaultValue={query.status}>
            <option value="">Todos</option>
            <option value="active">Ativo</option>
            <option value="disabled">Desativado</option>
          </select>
        </label>
        <button className="button small">Aplicar filtros</button>
      </form>
      <div className="admin-panel">
        <div className="admin-panel-title">
          <h2>Equipe administrativa</h2>
          <span>{result.total} registros</span>
        </div>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>AdminAccount</th>
                <th>Discord</th>
                <th>Status</th>
                <th>Nível</th>
                <th>Criado em</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((item) => (
                <tr key={item.adminAccountId}>
                  <td>
                    <Link href={`/admin/admins/${item.adminAccountId}`}>{item.adminAccountId}</Link>
                  </td>
                  <td>{item.discordId ?? 'Não vinculado'}</td>
                  <td>{item.status === 'active' ? 'Ativo' : 'Desativado'}</td>
                  <td>{item.isSystemOwner ? 'SYSTEM_OWNER' : 'Administrador'}</td>
                  <td>{new Date(item.createdAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {result.items.length === 0 && (
          <p className="admin-empty">Nenhum administrador encontrado para estes filtros.</p>
        )}
        <div className="admin-pagination">
          <span>Página {result.page}</span>
          {result.page > 1 && <Link href={pageUrl(result.page - 1)}>Anterior</Link>}
          {result.page * result.pageSize < result.total && <Link href={pageUrl(result.page + 1)}>Próxima</Link>}
        </div>
      </div>
    </>
  );
}
