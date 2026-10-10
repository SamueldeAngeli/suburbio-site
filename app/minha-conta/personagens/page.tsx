import { CharacterDetails, CharacterSlots } from '@/components/account/character-cards';
import { Users } from 'lucide-react';
import { redirect } from 'next/navigation';
import { currentSession } from '@/lib/auth/session';
import { SuburbioApiClient } from '@/lib/api/client';
import { EmptyState } from '@/components/account/empty-state';
import { SiteError } from '@/lib/api/errors';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Meus personagens — Subúrbio RP', robots: { index: false, follow: false } };
export default async function Characters() {
  const session = await currentSession();
  if (!session) redirect('/login?returnTo=/minha-conta/personagens');
  let data,
    linkRequired = false;
  try {
    data = (await new SuburbioApiClient().citizenCharacters(session.user.discordId)).data;
  } catch (error) {
    // Indisponível (API/QBCore fora) e vínculo ausente são estados distintos; nunca lista inventada.
    linkRequired = error instanceof SiteError && error.code === 'PLAYER_LINK_REQUIRED';
  }
  return (
    <main>
      <div className="citizen-section-heading">
        <div>
          <span className="citizen-kicker">SUAS IDENTIDADES NA CIDADE</span>
          <h2>Meus personagens</h2>
          <p>Dados atuais da cidade para os personagens da sua conta.</p>
        </div>
      </div>
      <section className="citizen-card">
        {data?.items.length ? (
          <CharacterDetails items={data.items} />
        ) : (
          <EmptyState
            icon={<Users size={29} strokeWidth={1.2} />}
            title={
              data ? 'Nenhum personagem na cidade.' : linkRequired ? 'Conta ainda não vinculada.' : 'Seus personagens'
            }
            description={
              data
                ? 'Crie seu personagem ao entrar na cidade.'
                : linkRequired
                  ? 'Entre na cidade com este Discord para vincular sua conta e ver seus personagens.'
                  : 'Não foi possível consultar seus personagens agora. Tente novamente em instantes.'
            }
          />
        )}
        <CharacterSlots slots={data?.slots} />
      </section>
    </main>
  );
}
