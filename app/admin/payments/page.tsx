import { ModulePage } from '@/components/admin/module-page';
export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ModulePage slug="payments" searchParams={searchParams} />;
}
