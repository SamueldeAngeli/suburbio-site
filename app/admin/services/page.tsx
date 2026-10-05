import { Suspense } from 'react';
import { pageAccess } from '@/lib/permissions/guards';
import { AccessUnavailable, PanelSkeleton } from '@/components/admin/states';
import { ServiceStatus } from '@/components/admin/service-status';
export default async function Services() {
  if (!(await pageAccess('SERVICES_READ', '/admin/services'))) return <AccessUnavailable />;
  return (
    <>
      <div className="admin-title">
        <span className="admin-kicker">OPERAÇÃO / DISPONIBILIDADE</span>
        <h1>
          Serviços<span>.</span>
        </h1>
        <p>O estado de cada integração, informado pela Subúrbio API.</p>
      </div>
      <Suspense fallback={<PanelSkeleton />}>
        <ServiceStatus />
      </Suspense>
    </>
  );
}
