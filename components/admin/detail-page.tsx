import { OrderStages } from '@/components/order-stages';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { uuid } from '@/lib/api/contracts';
import { pageAccess } from '@/lib/permissions/guards';
import { AccessUnavailable, GapState } from './states';
import { PlayerEntitlements } from './player-entitlements';
import { PlayerCrypto } from './player-crypto';
import { PlayerActivity } from './player-activity';
import {
  PlayerCharacters,
  PlayerOverview,
  PlayerPunishments,
  PlayerPurchases,
  PlayerTimeline,
} from './player-profile-tabs';
// Ficha do jogador: identidade e Discord na visão geral; pedidos/pagamentos em Compras; timeline e
// auditoria em Logs. Cada aba carrega só os próprios dados.
export const playerTabs = [
  'Visão geral',
  'Personagens',
  'Atividade',
  'Compras',
  'Punições',
  'Logs',
  'Crypto',
  'Benefícios',
  'Allowlist',
];
export async function DetailPage({
  kind,
  id,
  tab,
  page = 1,
  from,
  to,
  types = [],
}: {
  kind: 'players' | 'orders';
  id: string;
  tab?: string | string[];
  page?: number;
  from?: string;
  to?: string;
  types?: string[];
}) {
  if (!uuid.safeParse(id).success) notFound();
  const path = `/admin/${kind}/${id}`;
  const admin = await pageAccess(kind === 'players' ? 'PLAYERS_READ' : 'ORDERS_READ', path);
  if (!admin) return <AccessUnavailable />;
  const tabs =
    kind === 'players'
      ? playerTabs
      : [
          'Pedido',
          'Pagamento',
          'Entrega',
          'Benefício / Entitlement',
          'Notificação Discord',
          'Reembolso',
          'Chargeback',
          'Auditoria',
        ];
  const active = typeof tab === 'string' && tabs.includes(tab) ? tab : tabs[0];
  const orderStage =
    kind === 'orders' && ['Pagamento', 'Entrega', 'Benefício / Entitlement', 'Notificação Discord'].includes(active);
  return (
    <>
      <div className="admin-title">
        <Link href={`/admin/${kind}`} className="admin-kicker">
          ← {kind === 'players' ? 'JOGADORES' : 'PEDIDOS'}
        </Link>
        <h1>{kind === 'players' ? 'Perfil do jogador' : 'Detalhes do pedido'}</h1>
        {/* UUID interno não é o identificador do Staff: a ficha mostra cityId/nome/Discord. */}
        {kind === 'orders' && <p className="admin-id">ID consultado: {id}</p>}
      </div>
      <nav className="admin-tabs" aria-label="Seções do registro">
        {tabs.map((label) => (
          <Link
            key={label}
            href={`${path}?tab=${encodeURIComponent(label)}`}
            aria-current={active === label ? 'page' : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="admin-panel admin-panel-body">
        {orderStage ? (
          <OrderStages admin stage={active} />
        ) : kind === 'players' && active === 'Visão geral' ? (
          <PlayerOverview discordId={admin.discordId} playerId={id} />
        ) : kind === 'players' && active === 'Personagens' ? (
          <PlayerCharacters discordId={admin.discordId} playerId={id} />
        ) : kind === 'players' && active === 'Compras' ? (
          <PlayerPurchases discordId={admin.discordId} playerId={id} page={page} />
        ) : kind === 'players' && active === 'Punições' ? (
          <PlayerPunishments discordId={admin.discordId} playerId={id} />
        ) : kind === 'players' && active === 'Logs' ? (
          <PlayerTimeline discordId={admin.discordId} playerId={id} page={page} types={types} from={from} to={to} />
        ) : kind === 'players' && active === 'Benefícios' ? (
          <PlayerEntitlements discordId={admin.discordId} playerId={id} page={page} />
        ) : kind === 'players' && active === 'Atividade' ? (
          <PlayerActivity discordId={admin.discordId} playerId={id} page={page} from={from} to={to} />
        ) : kind === 'players' && active === 'Crypto' ? (
          <PlayerCrypto discordId={admin.discordId} playerId={id} page={page} />
        ) : (
          <GapState
            title="Dados ainda não integrados"
            description="O identificador informado ainda não pôde ser consultado. Nenhum registro é presumido como existente."
          />
        )}
        {kind === 'players' && active === 'Allowlist' && (
          <Link className="button outline" href={`/admin/allowlist?playerId=${id}`}>
            Consultar allowlist
          </Link>
        )}
      </div>
      {kind === 'orders' && active === 'Pedido' && <OrderStages admin />}
    </>
  );
}
