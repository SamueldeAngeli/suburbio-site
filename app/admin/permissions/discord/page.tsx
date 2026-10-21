import { pageAccess } from '@/lib/permissions/guards';
import { AccessUnavailable } from '@/components/admin/states';
import { SuburbioApiClient } from '@/lib/api/client';
import { SiteError } from '@/lib/api/errors';
import { capabilityGroups, TOTAL_CAPABILITIES } from '@/lib/admin/capabilities';
export default async function DiscordMappings() {
  const admin = await pageAccess('PERMISSIONS_READ', '/admin/permissions/discord');
  if (!admin) return <AccessUnavailable />;
  let items;
  try {
    items = (await new SuburbioApiClient().discordRoleMappings(admin.discordId)).data.items;
  } catch (error) {
    if (error instanceof SiteError) return <AccessUnavailable />;
    throw error;
  }
  return (
    <>
      <div className="admin-title">
        <span className="admin-kicker">GESTÃO / PERMISSÕES</span>
        <h1>Cargos do Discord</h1>
        <p>Configuração atual confirmada pelo servidor. Alterações de mapeamento são exclusivas do dono do sistema.</p>
      </div>
      <section className="admin-panel">
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cargo</th>
                <th>Permissões</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.guild_id}:${item.role_id}`}>
                  <td data-label="Cargo">
                    <span>
                      <strong>{item.label}</strong>
                      <small className="admin-muted" title={item.role_id}>
                        {' '}
                        · ID {item.role_id.slice(0, 6)}…
                      </small>
                    </span>
                  </td>
                  <td data-label="Permissões">
                    {item.capabilities.length === 0 ? (
                      <span className="admin-muted">Nenhuma</span>
                    ) : item.capabilities.length >= TOTAL_CAPABILITIES ? (
                      <span className="admin-state state-owner">Todas ({item.capabilities.length})</span>
                    ) : (
                      <ul className="admin-capabilities" title={item.capabilities.join(', ')}>
                        {capabilityGroups(item.capabilities).map((g) => (
                          <li key={g.area}>
                            <strong>{g.area}</strong> {g.actions.join(', ')}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td data-label="Status">
                    <span className={`admin-state state-${item.enabled ? 'active' : 'disabled'}`}>
                      {item.enabled ? 'Ativo' : 'Desativado'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="admin-note">O dono do sistema tem acesso total independentemente dos cargos do Discord.</p>
      </section>
    </>
  );
}
