import { Suspense } from 'react';
import Link from 'next/link';
import { pageAccess } from '@/lib/permissions/guards';
import { can } from '@/lib/permissions/policy';
import { AccessUnavailable, GapState, PanelSkeleton } from '@/components/admin/states';
import { ServiceStatus } from '@/components/admin/service-status';
export default async function Dashboard() {
  const admin = await pageAccess('DASHBOARD_READ', '/admin');
  if (!admin) return <AccessUnavailable />;
  return (
    <>
      <div className="admin-title">
        <span className="admin-kicker">SUBÚRBIO / CONTROL CENTER</span>
        <h1>
          Visão geral<span>.</span>
        </h1>
        <p>O essencial para cuidar da cidade, com informação de verdade.</p>
      </div>
      <div className="admin-metrics">
        {[
          'Jogadores',
          'Allowlists ativas',
          'Pedidos hoje',
          'Receita hoje',
          'Pagamentos pendentes',
          'Reembolsos',
          'Chargebacks',
        ].map((label) => (
          <article key={label}>
            <span>{label}</span>
            <strong>—</strong>
            <small>Dados ainda não integrados</small>
          </article>
        ))}
      </div>
      <div className="admin-dashboard-grid">
        <div>
          {can(admin, 'SERVICES_READ') ? (
            <Suspense fallback={<PanelSkeleton />}>
              <ServiceStatus />
            </Suspense>
          ) : (
            <GapState title="Status restrito" description="Seu acesso não inclui a consulta de serviços." />
          )}
        </div>
        <div className="admin-panel">
          <div className="admin-panel-title">
            <h2>Atividade recente</h2>
          </div>
          <GapState description="Pedidos, pagamentos e ações administrativas aparecerão após a integração oficial." />
        </div>
      </div>
      <div className="admin-quick-links">
        {can(admin, 'ALLOWLIST_READ') && <Link href="/admin/allowlist">Consultar allowlist →</Link>}
        {can(admin, 'AUDIT_READ') && <Link href="/admin/audit">Auditoria administrativa →</Link>}
      </div>
    </>
  );
}
