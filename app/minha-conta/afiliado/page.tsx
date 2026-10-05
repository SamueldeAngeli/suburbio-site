import { redirect, notFound } from 'next/navigation';
import { currentSession } from '@/lib/auth/session';
import { SuburbioApiClient } from '@/lib/api/client';
import { SiteError } from '@/lib/api/errors';
import { periodSchema } from '@/lib/api/affiliate-contracts';
import { AffiliateDashboard } from '@/components/affiliate/dashboard';
import { EmptyState } from '@/components/account/empty-state';
import '@/app/affiliate.css';
export const metadata = { title: 'Afiliado — Subúrbio RP', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export default async function Page({ searchParams }: { searchParams: Promise<{ period?: string; page?: string }> }) {
  const session = await currentSession();
  if (!session) redirect('/login?returnTo=/minha-conta/afiliado');
  const params = await searchParams,
    period = periodSchema.safeParse(params.period),
    page = Number(params.page ?? 1);
  if (!period.success || !Number.isInteger(page) || page < 1 || page > 100000) notFound();
  let data;
  try {
    data = (await new SuburbioApiClient().affiliateDashboard(session.user.discordId, period.data, page)).data;
  } catch (error) {
    if (error instanceof SiteError && [403, 404].includes(error.status)) notFound();
    return (
      <EmptyState
        title="Seu painel estará disponível em breve."
        description="Não foi possível consultar seus dados. Tente novamente em instantes."
      />
    );
  }
  return <AffiliateDashboard data={data} />;
}
