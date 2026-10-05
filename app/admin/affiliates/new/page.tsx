import { pageAccess } from '@/lib/permissions/guards';
import { AccessUnavailable } from '@/components/admin/states';
import { AffiliateEditor } from '@/components/admin/affiliate-editor';
export default async function Page() {
  const admin = await pageAccess('AFFILIATES_MANAGE', '/admin/affiliates/new');
  if (!admin) return <AccessUnavailable />;
  return admin.readOnly ? <p>Alterações temporariamente indisponíveis.</p> : <AffiliateEditor />;
}
