import { CharacterCards } from '@/components/account/character-cards';
import { Users } from 'lucide-react';
import { redirect } from 'next/navigation';
import { currentSession } from '@/lib/auth/session';
import { SuburbioApiClient } from '@/lib/api/client';
import { EmptyState } from '@/components/account/empty-state';
import { SlotsSummary } from '@/components/commerce-preparation';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Meus personagens — Subúrbio RP', robots: { index: false, follow: false } };
export default async function Characters() {
  const session = await currentSession();
  if (!session) redirect('/login?returnTo=/minha-conta/personagens');
  let data;
  try {
    data = (await new SuburbioApiClient().citizenCharacters(session.user.discordId)).data;
  } catch {}
  return (
    <main>
      <div className="citizen-section-heading">
        <div>
          <span className="citizen-kicker">SUAS IDENTIDADES NA CIDADE</span>
          <h2>Meus personagens</h2>
          <p>Personagens vinculados à sua conta. A lista não determina seu limite de slots.</p>
        </div>
      </div>
      <section className="citizen-card">
        {data?.items.length ? (
          <CharacterCards items={data.items} />
        ) : (
          <EmptyState
            icon={<Users size={29} strokeWidth={1.2} />}
            title={data ? 'Nenhum personagem vinculado.' : 'Seus personagens'}
            description={
              data
                ? 'Ainda não há personagens registrados para esta conta.'
                : 'Os dados dos seus personagens ainda não estão disponíveis.'
            }
          />
        )}
        <SlotsSummary />
      </section>
    </main>
  );
}
