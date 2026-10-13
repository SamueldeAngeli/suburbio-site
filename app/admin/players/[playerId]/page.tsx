import { DetailPage } from '@/components/admin/detail-page';
export default async function PlayerDetail({
  params,
  searchParams,
}: {
  params: Promise<{ playerId: string }>;
  searchParams: Promise<{ tab?: string | string[]; page?: string; from?: string; to?: string }>;
}) {
  const { playerId } = await params;
  const query = await searchParams;
  return (
    <DetailPage
      kind="players"
      id={playerId}
      tab={query.tab}
      page={Number(query.page ?? 1)}
      from={typeof query.from === 'string' ? query.from : undefined}
      to={typeof query.to === 'string' ? query.to : undefined}
    />
  );
}
