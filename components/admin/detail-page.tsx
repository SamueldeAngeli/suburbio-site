import { OrderStages } from '@/components/order-stages';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { uuid } from '@/lib/api/contracts';
import { pageAccess } from '@/lib/permissions/guards';
import { AccessUnavailable, GapState } from './states';
import { PlayerEntitlements } from './player-entitlements';
export const playerTabs = [
  'Visão geral',
  'Benefícios',
  'Personagens',
  'Identidade',
  'Allowlist',
  'Punições',
  'Pedidos',
  'Pagamentos',
  'Inventário',
  'Veículos',
  'Economia',
  'Propriedades',
  'Timeline',
  'Discord',
  'Auditoria',
];
export async function DetailPage({
  kind,
  id,
  tab,
  page = 1,
}: {
  kind: 'players' | 'orders';
  id: string;
  tab?: string | string[];
  page?: number;
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
  const futureFiveM = ['Personagens', 'Inventário', 'Veículos', 'Economia', 'Propriedades'].includes(active);
  return (
    <>
      <div className="admin-title">
        <Link href={`/admin/${kind}`} className="admin-kicker">
          ← {kind === 'players' ? 'JOGADORES' : 'PEDIDOS'}
        </Link>
        <h1>{kind === 'players' ? 'Perfil do jogador' : 'Detalhes do pedido'}</h1>
        <p className="admin-id">ID consultado: {id}</p>
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
      <div className="admin-panel">
        {orderStage ? (
          <OrderStages admin stage={active} />
        ) : kind === 'players' && active === 'Benefícios' ? (
          <PlayerEntitlements discordId={admin.discordId} playerId={id} page={page} />
        ) : (
          <GapState
            title={futureFiveM ? 'Disponível após integração FiveM' : 'Dados ainda não integrados'}
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
