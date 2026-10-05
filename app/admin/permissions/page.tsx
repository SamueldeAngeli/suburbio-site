import Link from 'next/link';
import { ModulePage } from '@/components/admin/module-page';
export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <>
      <p>
        <Link className="button outline" href="/admin/permissions/discord">
          Cargos do Discord →
        </Link>
      </p>
      <ModulePage slug="permissions" searchParams={searchParams} />
    </>
  );
}
