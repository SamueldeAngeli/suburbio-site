import { pageAccess } from '@/lib/permissions/guards';
import { can } from '@/lib/permissions/policy';
import { uuid } from '@/lib/api/contracts';
import { AllowlistService } from '@/lib/api/modules/allowlist';
import { safeError } from '@/lib/api/errors';
import { AccessUnavailable, ErrorState, GapState } from '@/components/admin/states';
import { RevokeForm } from '@/components/admin/revoke-form';
import { DataList } from '@/components/admin/module-page';
import { adminLists } from '@/lib/admin/lists';
import { listQuerySchema } from '@/lib/api/modules/pending';
export default async function AllowlistPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await pageAccess('ALLOWLIST_READ', '/admin/allowlist');
  if (!admin) return <AccessUnavailable />;
  const raw = await searchParams;
  const { playerId } = raw;
  const listQuery = listQuerySchema.safeParse(
    Object.fromEntries(Object.entries(raw).filter(([key]) => ['q', 'page', 'status'].includes(key))),
  );
  let content: React.ReactNode = null;
  if (playerId) {
    if (!uuid.safeParse(playerId).success)
      content = (
        <p className="admin-warning" role="alert">
          Informe um Player ID válido no formato UUID.
        </p>
      );
    else {
      try {
        const { data } = await new AllowlistService().get(playerId as string);
        content = (
          <div className="admin-record">
            <dl>
              <div>
                <dt>Player ID</dt>
                <dd>{data.player_id}</dd>
              </div>
              <div>
                <dt>Allowlist ID</dt>
                <dd>{data.allowlist_id}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <span className="admin-badge">{data.status}</span>
                </dd>
              </div>
              <div>
                <dt>Última atualização</dt>
                <dd>{new Date(data.updated_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</dd>
              </div>
            </dl>
            <RevokeForm
              playerId={data.player_id}
              disabled={admin.readOnly || !can(admin, 'ALLOWLIST_REVOKE') || data.status !== 'active'}
            />
          </div>
        );
      } catch (error) {
        const e = safeError(error);
        content = <ErrorState message={e.body.error.message} reference={e.body.error.reference} />;
      }
    }
  }
  return (
    <>
      <div className="admin-title">
        <span className="admin-kicker">CIDADE / CONTROLE DE ACESSO</span>
        <h1>
          Allowlist<span>.</span>
        </h1>
        <p>Consulte o acesso de um jogador pelo identificador da API.</p>
      </div>
      <form className="admin-filter" method="get">
        <label>
          Player ID
          <input
            name="playerId"
            required
            maxLength={36}
            placeholder="UUID do jogador"
            defaultValue={typeof playerId === 'string' ? playerId : ''}
          />
        </label>
        <button className="button small">Consultar</button>
      </form>
      {content && <div className="admin-panel">{content}</div>}
      <form className="admin-filter" method="get">
        <label>
          Buscar na lista
          <input
            name="q"
            maxLength={100}
            placeholder={adminLists.allowlist.searchHint}
            defaultValue={listQuery.success ? listQuery.data.q : ''}
          />
        </label>
        <label>
          Status
          <input
            name="status"
            maxLength={40}
            placeholder={adminLists.allowlist.statusHint}
            defaultValue={listQuery.success ? listQuery.data.status : ''}
          />
        </label>
        <input type="hidden" name="page" value="1" />
        <button className="button small">Filtrar</button>
      </form>
      {listQuery.success ? (
        <DataList
          slug="allowlist"
          title="Allowlists"
          config={adminLists.allowlist}
          actor={admin.discordId}
          query={listQuery.data}
        />
      ) : (
        <GapState title="Filtros inválidos" description="Revise a busca e a página." />
      )}
    </>
  );
}
