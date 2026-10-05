import { pageAccess } from '@/lib/permissions/guards';
import { AccessUnavailable } from '@/components/admin/states';
import { SuburbioApiClient } from '@/lib/api/client';
import { SiteError } from '@/lib/api/errors';
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
    <section className="admin-panel">
      <h1>Cargos do Discord</h1>
      <p>Configuração atual confirmada pelo servidor. Alterações de mapeamento são exclusivas do SYSTEM_OWNER.</p>
      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cargo</th>
              <th>Role ID</th>
              <th>Permissões</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={`${item.guild_id}:${item.role_id}`}>
                <td>{item.label}</td>
                <td>{item.role_id}</td>
                <td>{item.capabilities.join(', ') || 'Nenhuma'}</td>
                <td>{item.enabled ? 'Ativo' : 'Desativado'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>SYSTEM_OWNER permanece independente dos cargos do Discord.</p>
    </section>
  );
}
