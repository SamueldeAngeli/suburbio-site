import Link from 'next/link';
import { z } from 'zod';
import { pageAccess } from '@/lib/permissions/guards';
import { SuburbioApiClient } from '@/lib/api/client';
import { safeError } from '@/lib/api/errors';
import { AccessUnavailable, ErrorState } from './states';
import { DiscordPerson } from './discord-person';
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
          <input
            name="q"
            maxLength={100}
            defaultValue={query.q}
            placeholder="ID do Discord ou da conta administrativa"
          />
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
          <span className="admin-badge">
            {result.total} {result.total === 1 ? 'administrador' : 'administradores'}
          </span>
        </div>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Administrador</th>
                <th>Nível</th>
                <th>Status</th>
                <th>Desde</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((item) => (
                <tr key={item.adminAccountId}>
                  <td data-label="Administrador">
                    <DiscordPerson
                      id={item.discordId}
                      name={item.discordName}
                      username={item.discordUsername}
                      avatar={item.discordAvatar}
                    />
                  </td>
                  <td data-label="Nível">
                    {item.isSystemOwner ? (
                      <span className="admin-state state-owner">Dono do sistema</span>
                    ) : (
                      'Administrador'
                    )}
                  </td>
                  <td data-label="Status">
                    <span className={`admin-state state-${item.status}`}>
                      {item.status === 'active' ? 'Ativo' : 'Desativado'}
                    </span>
                  </td>
                  <td data-label="Desde">
                    {new Date(item.createdAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                  </td>
                  <td data-label="">
                    <Link href={`/admin/admins/${item.adminAccountId}`} title={item.adminAccountId}>
                      Ver detalhes
                    </Link>
                  </td>
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
