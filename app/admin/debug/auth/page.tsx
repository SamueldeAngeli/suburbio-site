import { notFound } from 'next/navigation';
import { serverEnv } from '@/lib/server/env';
import { pageAccess } from '@/lib/permissions/guards';
import { currentSession } from '@/lib/auth/session';
import { currentMembership } from '@/lib/auth/discord-membership';
export const dynamic = 'force-dynamic';
export default async function AuthDebug() {
  const env = serverEnv();
  if (env.NODE_ENV !== 'development') notFound();
  const admin = await pageAccess('', '/admin/debug/auth');
  if (!admin?.fullAccess || admin.accessLevel !== 'SYSTEM_OWNER') notFound();
  const session = await currentSession(),
    membership = await currentMembership(admin.discordId);
  return (
    <section className="admin-panel">
      <h1>Diagnóstico de autenticação</h1>
      <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        {JSON.stringify(
          {
            discordId: admin.discordId,
            guildId: membership.guildId,
            membership: membership.status,
            verifiedRoleIds: membership.verifiedRoleIds,
            adminAccountId: admin.adminAccountId,
            isSystemOwner: true,
            effectiveCapabilities: admin.capabilities,
            lastDiscordVerification: membership.status === 'UNAVAILABLE' ? null : membership.verifiedAt,
            apiConnectivity: 'Autorização institucional validada nesta requisição',
            sessionExpiry: session?.expires,
            roleIntegrationEnabled: env.DISCORD_ROLE_AUTH_ENABLED,
          },
          null,
          2,
        )}
      </pre>
    </section>
  );
}
