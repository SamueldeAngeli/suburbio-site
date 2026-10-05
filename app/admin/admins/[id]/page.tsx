import { notFound } from 'next/navigation';
import { pageAccess } from '@/lib/permissions/guards';
import { SuburbioApiClient } from '@/lib/api/client';
import { uuid } from '@/lib/api/contracts';
import { safeError } from '@/lib/api/errors';
import { AccessUnavailable, ErrorState } from '@/components/admin/states';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await pageAccess('ADMINS_READ', `/admin/admins/${id}`);
  if (!admin) return <AccessUnavailable />;
  if (!uuid.safeParse(id).success) notFound();
  let item;
  try {
    item = (await new SuburbioApiClient().admin(admin.discordId, id)).data;
  } catch (error) {
    const safe = safeError(error);
    return <ErrorState message={safe.body.error.message} reference={safe.body.error.reference} />;
  }
  return (
    <>
      <div className="admin-title">
        <span className="admin-kicker">GESTÃO / ADMINISTRADORES</span>
        <h1>Conta administrativa</h1>
        <p>{item.adminAccountId}</p>
      </div>
      <section className="admin-panel">
        <h2>{item.isSystemOwner ? 'SYSTEM_OWNER' : 'Administrador'}</h2>
        <dl>
          <dt>Discord</dt>
          <dd>{item.discordId ?? 'Não vinculado'}</dd>
          <dt>Status</dt>
          <dd>{item.status === 'active' ? 'Ativo' : 'Desativado'}</dd>
          <dt>Criado em</dt>
          <dd>{new Date(item.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</dd>
        </dl>
        <p className="admin-note">
          A identidade administrativa permanece independente dos personagens e dos wipes da cidade.
        </p>
      </section>
    </>
  );
}
