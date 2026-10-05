import type { Metadata } from 'next';
import { pageAccess } from '@/lib/permissions/guards';
import { can } from '@/lib/permissions/policy';
import { adminModules } from '@/lib/admin/modules';
import { AdminShell } from '@/components/admin/shell';
import { AccessUnavailable } from '@/components/admin/states';
import { logout } from '@/lib/auth/actions';
import './admin.css';
export const metadata: Metadata = { title: 'Administração — Subúrbio RP', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await pageAccess('', '/admin');
  if (!admin)
    return (
      <main className="admin-root">
        <AccessUnavailable />
        <form action={logout} className="admin-gate-logout">
          <button className="button outline">Sair da conta</button>
        </form>
      </main>
    );
  const modules = adminModules.map((m, iconIndex) => ({ ...m, iconIndex })).filter((m) => can(admin, m.capability));
  return (
    <div className="admin-root">
      <AdminShell modules={modules} name={admin.displayName} owner={admin.accessLevel === 'SYSTEM_OWNER'}>
        {admin.readOnly && (
          <div className="admin-warning" role="status">
            Modo somente leitura. Alterações estão desabilitadas.
          </div>
        )}
        {children}
      </AdminShell>
    </div>
  );
}
