import Link from 'next/link';
import { SuburbioApiClient } from '@/lib/api/client';
import { safeError } from '@/lib/api/errors';
import { ErrorState } from './states';
import { EntitlementsTable } from '@/components/entitlements-table';
export async function PlayerEntitlements({
  discordId,
  playerId,
  page,
}: {
  discordId: string;
  playerId: string;
  page: number;
}) {
  let data;
  try {
    data = (await new SuburbioApiClient().entitlements(discordId, page, playerId)).data;
  } catch (error) {
    const e = safeError(error).body.error;
    return <ErrorState message={e.message} reference={e.reference} />;
  }
  const url = (p: number) => `?${new URLSearchParams({ tab: 'Benefícios', page: String(p) })}`;
  return (
    <>
      <h2>Entitlements / Benefícios</h2>
      <EntitlementsTable data={data} admin />
      <div className="admin-pagination">
        {page > 1 && <Link href={url(page - 1)}>← Anterior</Link>}
        <span>{data.total} benefícios</span>
        {page * data.pageSize < data.total && <Link href={url(page + 1)}>Próxima →</Link>}
      </div>
    </>
  );
}
