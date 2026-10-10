import Link from 'next/link';
import { CharacterCards, CharacterSlots } from '@/components/account/character-cards';
import { CryptoBalance } from '@/components/site/crypto-balance';
import { Crown, ShoppingBag, Users, ArrowUpRight } from 'lucide-react';
import { redirect } from 'next/navigation';
import { currentSession } from '@/lib/auth/session';
import { SuburbioApiClient } from '@/lib/api/client';
import { remainingLabel } from '@/lib/entitlements';
import { orderStatusLabel } from '@/lib/api/order-contracts';
import { commerceAmount } from '@/lib/commerce-amount';
import { EmptyState } from '@/components/account/empty-state';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Minha conta — Subúrbio RP', robots: { index: false, follow: false } };
export default async function Account() {
  const session = await currentSession();
  if (!session) redirect('/login?returnTo=/minha-conta');
  const client = new SuburbioApiClient();
  const [benefits, orders, characters] = await Promise.allSettled([
    client.entitlements(session.user.discordId),
    client.orders(session.user.discordId),
    client.citizenCharacters(session.user.discordId),
  ]);
  const data = benefits.status === 'fulfilled' ? benefits.value.data : null,
    orderData = orders.status === 'fulfilled' ? orders.value.data : null;
  const characterData = characters.status === 'fulfilled' ? characters.value.data : null;
  const active = data?.items.filter((item) => item.type === 'VIP' && item.status === 'ACTIVE') ?? [];
  return (
    <main className="citizen-overview">
      <div className="citizen-section-heading">
        <div>
          <span className="citizen-kicker">BOM TER VOCÊ POR AQUI</span>
          <h2>Seu próximo capítulo.</h2>
          <p>Seus benefícios e pedidos, em um só lugar.</p>
        </div>
        <span className="citizen-section-mark" aria-hidden="true">
          ✳
        </span>
      </div>
      <div className="citizen-overview-grid">
        <CryptoBalance card />
        <section className="citizen-card citizen-vip">
          <div className="citizen-card-top">
            <span>
              <Crown size={16} /> SEUS VIPs
            </span>
            <Link href="/minha-conta/beneficios" aria-label="Ver todos os benefícios">
              <ArrowUpRight size={18} />
            </Link>
          </div>
          {active.length ? (
            active.map((vip) => (
              <div className="citizen-active-vip" key={vip.id}>
                <span className="citizen-badge">ATIVO</span>
                <h3>{vip.productName}</h3>
                <p>{remainingLabel(vip.status, vip.expiresAt, data!.asOf)}</p>
                <p>
                  Início: {vip.startsAt ? new Date(vip.startsAt).toLocaleDateString('pt-BR') : 'Não informado'} ·
                  Expiração: {vip.expiresAt ? new Date(vip.expiresAt).toLocaleDateString('pt-BR') : 'Permanente'}
                </p>
                <Link className="citizen-text-link" href="/minha-conta/beneficios">
                  Ver benefícios <ArrowUpRight size={15} />
                </Link>
              </div>
            ))
          ) : (
            <EmptyState
              icon={<Crown size={29} strokeWidth={1.2} />}
              title={
                data && data.total <= data.pageSize
                  ? 'Nenhum VIP ativo no momento.'
                  : data
                    ? 'Seus benefícios VIP'
                    : 'Vamos conferir seus VIPs?'
              }
              description={
                data && data.total <= data.pageSize
                  ? 'Encontre o plano que combina com o seu corre.'
                  : data
                    ? 'Consulte todos os registros na aba Benefícios.'
                    : 'Não foi possível consultar seus benefícios agora.'
              }
              href={data ? '/#loja' : '/minha-conta/beneficios'}
              label={data ? 'Conhecer VIPs' : 'Consultar benefícios'}
            />
          )}
        </section>
        <section className="citizen-card citizen-character-card">
          <div className="citizen-card-top">
            <span>
              <Users size={16} /> PERSONAGENS
            </span>
            <Link href="/minha-conta/personagens" aria-label="Ver personagens">
              <ArrowUpRight size={18} />
            </Link>
          </div>
          {characterData?.items.length ? (
            <CharacterCards items={characterData.items.slice(0, 2)} />
          ) : (
            <EmptyState
              icon={<Users size={28} strokeWidth={1.2} />}
              title="Cada história, uma identidade."
              description={
                characterData
                  ? 'Nenhum personagem na cidade ainda.'
                  : 'Os dados dos seus personagens ainda não estão disponíveis.'
              }
            />
          )}
          <CharacterSlots slots={characterData?.slots} />
        </section>
        <section className="citizen-card citizen-recent">
          <div className="citizen-card-top">
            <span>
              <ShoppingBag size={16} /> ÚLTIMOS PEDIDOS
            </span>
            <Link className="citizen-text-link" href="/minha-conta/pedidos">
              Ver todos <ArrowUpRight size={15} />
            </Link>
          </div>
          {orderData?.items.length ? (
            <div className="citizen-recent-list">
              {orderData.items.slice(0, 3).map((order) => (
                <Link key={order.id} href={`/minha-conta/pedidos/${order.id}`}>
                  <span>
                    #{order.id.slice(0, 8)}
                    <small>
                      {new Date(order.createdAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                    </small>
                  </span>
                  <span className="citizen-badge" data-status={order.status}>
                    {orderStatusLabel[order.status]}
                  </span>
                  <strong>{commerceAmount(order.netAmountMinor, order.currency)}</strong>
                  <ArrowUpRight size={16} />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<ShoppingBag size={27} strokeWidth={1.2} />}
              title={orderData ? 'Sua próxima conquista começa aqui.' : 'Seus pedidos, sempre por perto.'}
              description={
                orderData ? 'Você ainda não possui pedidos.' : 'Não foi possível consultar seus pedidos agora.'
              }
              href={orderData ? '/#loja' : '/minha-conta/pedidos'}
              label={orderData ? 'Ver Área VIP' : 'Consultar pedidos'}
            />
          )}
        </section>
      </div>
    </main>
  );
}
