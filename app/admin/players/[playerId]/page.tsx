import { DetailPage } from '@/components/admin/detail-page';
export default async function PlayerDetail({
  params,
  searchParams,
}: {
  params: Promise<{ playerId: string }>;
  searchParams: Promise<{ tab?: string | string[]; page?: string }>;
}) {
  const { playerId } = await params;
  return (
    <DetailPage
      kind="players"
      id={playerId}
      tab={(await searchParams).tab}
      page={Number((await searchParams).page ?? 1)}
    />
  );
}
