import Link from 'next/link';
import { SuburbioApiClient } from '@/lib/api/client';
import { safeError } from '@/lib/api/errors';
import { formatCrypto } from '@/lib/api/citizen-contracts';
import { commerceAmount } from '@/lib/commerce-amount';
import { orderStatusLabel } from '@/lib/api/order-contracts';
import { TIMELINE_TYPES } from '@/lib/api/player-profile-contracts';
import { ErrorState } from './states';
import { DiscordIdentityCard } from './discord-identity';
import { duration } from './player-activity';

// Abas da ficha: cada componente busca só os próprios dados (lazy). RBAC validado na API;
// RESTRICTED/UNAVAILABLE são exibidos como tais, nunca como zero.
type Props = { discordId: string; playerId: string };
const TZ = 'America/Sao_Paulo';
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: TZ }) : '—');
const brl = (minor: string) => commerceAmount(minor, 'BRL');
const role = (r: { label: string; grade: string | null } | null) =>
  r ? (r.grade ? `${r.label} · ${r.grade}` : r.label) : '—';
const missing = (reason: 'RESTRICTED' | 'UNAVAILABLE') => (reason === 'RESTRICTED' ? 'Sem permissão' : 'Indisponível');
const failure = (error: unknown) => {
  const e = safeError(error).body.error;
  return <ErrorState message={e.message} reference={e.reference} />;
};

export async function PlayerOverview({ discordId, playerId }: Props) {
  let o;
  try {
    o = (await new SuburbioApiClient().playerOverview(discordId, playerId)).data;
  } catch (error) {
    return failure(error);
  }
  const s = o.summary;
  const allowlist = { active: 'Ativa', revoked: 'Revogada', none: 'Sem allowlist' }[s.allowlist];
  return (
    <>
      <div className="admin-record" role="status">
        {o.status.online ? (
          <p>
            <span className="admin-badge">ONLINE</span> Online há{' '}
            {duration(Math.max(0, Math.floor((Date.parse(o.status.lastSeenAt) - Date.parse(o.status.since)) / 1000)))} ·
            Personagem {o.status.citizenId}
            {o.status.cityId !== null && ` · ID ${o.status.cityId}`} · Servidor {o.status.serverId}
          </p>
        ) : (
          <p>
            <span className="admin-badge">OFFLINE</span> Último acesso: {when(o.lastSeenAt)}
          </p>
        )}
      </div>
      <h2>Identidade</h2>
      <dl className="admin-record">
        <div>
          <dt>Nome</dt>
          <dd>{o.identity.characterName ?? '—'}</dd>
        </div>
        <div>
          <dt>ID da cidade</dt>
          <dd>{o.identity.cityId ?? '—'}</dd>
        </div>
        <div>
          <dt>CitizenId atual</dt>
          <dd>{o.identity.citizenId ?? '—'}</dd>
        </div>
        <div>
          <dt>Discord</dt>
          <dd>
            <DiscordIdentityCard identity={o.identity.discord} />
          </dd>
        </div>
        <div>
          <dt>Steam</dt>
          <dd>{o.identity.steam ?? 'Não informado'}</dd>
        </div>
        <div>
          <dt>FiveM ID</dt>
          <dd>{o.identity.fivem ?? 'Não informado'}</dd>
        </div>
        <div>
          <dt>License</dt>
          <dd>
            {o.identity.license.available ? (o.identity.license.value ?? '—') : missing(o.identity.license.reason)}
          </dd>
        </div>
        <div>
          <dt>Primeiro acesso</dt>
          <dd>{when(o.firstSeenAt)}</dd>
        </div>
        <div>
          <dt>Último acesso</dt>
          <dd>{when(o.lastSeenAt)}</dd>
        </div>
      </dl>
      <h2>Resumo</h2>
      <div className="admin-metrics">
        {(
          [
            ['Tempo total jogado', duration(s.playtimeSeconds)],
            ['Personagens', s.characters.available ? String(s.characters.count) : missing(s.characters.reason)],
            ['Gasto (BRL)', s.spent.available ? brl(s.spent.brlMinor) : missing(s.spent.reason)],
            ['Gasto (Crypto)', s.spent.available ? formatCrypto(s.spent.crypto) : missing(s.spent.reason)],
            [
              'Saldo Crypto',
              s.cryptoBalance.available ? formatCrypto(s.cryptoBalance.balance) : missing(s.cryptoBalance.reason),
            ],
            [
              'Banimentos registrados',
              s.punishments.available ? String(s.punishments.bans) : missing(s.punishments.reason),
            ],
            ['Allowlist', allowlist],
          ] as const
        ).map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
    </>
  );
}

export async function PlayerCharacters({ discordId, playerId }: Props) {
  let data;
  try {
    data = (await new SuburbioApiClient().playerCharacters(discordId, playerId)).data;
  } catch (error) {
    return failure(error);
  }
  return (
    <>
      <h2>Personagens</h2>
      {data.items.length === 0 && <p className="admin-empty">Nenhum personagem na cidade.</p>}
      {data.items.map((c) => (
        <details key={c.citizenId} className="admin-record">
          <summary>
            <strong>{c.name ?? 'Nome não informado'}</strong> · ID {c.cityId} · {c.citizenId} ·{' '}
            {c.online ? 'Online' : 'Offline'} · {duration(c.playtimeSeconds)} jogadas
          </summary>
          <dl>
            <div>
              <dt>Emprego</dt>
              <dd>{role(c.job)}</dd>
            </div>
            <div>
              <dt>Organização</dt>
              <dd>{c.gang ? role(c.gang) : 'Nenhuma'}</dd>
            </div>
            <div>
              <dt>Em mãos / Banco</dt>
              <dd>
                {c.money
                  ? `${c.money.cash.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / ${c.money.bank.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                  : 'Indisponível'}
              </dd>
            </div>
            <div>
              <dt>Último acesso</dt>
              <dd>{c.lastAccessAt ? when(c.lastAccessAt) : 'Sem sessão registrada'}</dd>
            </div>
            <div>
              <dt>Criação</dt>
              <dd>{c.createdAt ? when(c.createdAt) : 'Indisponível na base da cidade'}</dd>
            </div>
          </dl>
        </details>
      ))}
    </>
  );
}

export async function PlayerPurchases({ discordId, playerId, page }: Props & { page: number }) {
  let data;
  try {
    data = (await new SuburbioApiClient().playerPurchases(discordId, playerId, page)).data;
  } catch (error) {
    return failure(error);
  }
  const url = (p: number) => `?${new URLSearchParams({ tab: 'Compras', page: String(p) })}`;
  return (
    <>
      <h2>Compras</h2>
      <div className="admin-metrics">
        <article>
          <span>Gasto aprovado em BRL</span>
          <strong>{brl(data.totals.brlApprovedMinor)}</strong>
        </article>
        <article>
          <span>Gasto aprovado em Crypto</span>
          <strong>{formatCrypto(data.totals.cryptoApproved)}</strong>
        </article>
      </div>
      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Produto</th>
              <th>Origem</th>
              <th>Moeda</th>
              <th>Valor original</th>
              <th>Desconto</th>
              <th>Valor final</th>
              <th>Cupom</th>
              <th>Status</th>
              <th>Pedido</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((o) => (
              <tr key={o.id}>
                <td>{when(o.createdAt)}</td>
                <td>{o.products.map((p) => `${p.quantity}× ${p.name}`).join(', ') || '—'}</td>
                <td>{o.salesChannel === 'INGAME' ? 'In-game' : 'Site'}</td>
                <td>{o.currency === 'CRYPTO' ? 'Crypto' : o.currency}</td>
                <td>{commerceAmount(o.grossAmountMinor, o.currency)}</td>
                <td>{commerceAmount(o.discountAmountMinor, o.currency)}</td>
                <td>{commerceAmount(o.netAmountMinor, o.currency)}</td>
                <td>{o.couponCode ?? '—'}</td>
                <td>{orderStatusLabel[o.status]}</td>
                <td>
                  <Link href={`/admin/orders/${o.id}`}>{o.id.slice(0, 8)}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.items.length === 0 && <p className="admin-empty">Nenhuma compra registrada.</p>}
      <div className="admin-pagination">
        {page > 1 && <Link href={url(page - 1)}>← Anterior</Link>}
        <span>{data.total} pedidos</span>
        {page * data.pageSize < data.total && <Link href={url(page + 1)}>Próxima →</Link>}
      </div>
    </>
  );
}

export async function PlayerPunishments({ discordId, playerId }: Props) {
  let data;
  try {
    data = (await new SuburbioApiClient().playerPunishments(discordId, playerId)).data;
  } catch (error) {
    return failure(error);
  }
  return (
    <>
      <h2>Punições</h2>
      <p className="admin-warning" role="status">
        Fonte: banimentos da base da cidade (QBCore). Data e expiração não são confirmadas por essa fonte e não são
        calculadas aqui.
      </p>
      <p>
        Bloqueio legado de acesso:{' '}
        {data.legacyBlocked === null ? 'Indisponível' : data.legacyBlocked ? 'Bloqueado' : 'Não bloqueado'}
      </p>
      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Motivo</th>
              <th>Responsável</th>
              <th>Data</th>
              <th>Expiração</th>
              <th>Status</th>
              <th>Origem</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((p) => (
              <tr key={p.id}>
                <td>Banimento</td>
                <td>{p.reason ?? '—'}</td>
                <td>{p.responsible}</td>
                <td>Indisponível</td>
                <td>{p.expireRaw === null ? '—' : `Valor bruto ${p.expireRaw} (unidade não confirmada)`}</td>
                <td>Não confirmado</td>
                <td>Cidade (QBCore)</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.items.length === 0 && <p className="admin-empty">Nenhum banimento registrado.</p>}
    </>
  );
}

const typeLabel = {
  session: 'Sessão',
  allowlist: 'Allowlist',
  admin: 'Ação administrativa',
  order: 'Pedido',
  payment: 'Pagamento',
  crypto: 'Crypto',
  entitlement: 'Benefício',
} as const;
const actionLabel: Record<string, string> = {
  connected: 'Entrou na cidade',
  disconnected: 'Saiu da cidade',
  character_switch: 'Trocou de personagem',
  created: 'Criado',
  approved: 'Aprovado',
  activated: 'Ativado',
  expired: 'Expirado',
  revoked: 'Revogado',
};
export async function PlayerTimeline({
  discordId,
  playerId,
  page,
  types,
  from,
  to,
}: Props & { page: number; types: string[]; from?: string; to?: string }) {
  let data;
  try {
    data = (await new SuburbioApiClient().playerTimeline(discordId, playerId, { types, from, to, page })).data;
  } catch (error) {
    return failure(error);
  }
  const url = (p: number) => {
    const q = new URLSearchParams({ tab: 'Logs', page: String(p) });
    for (const t of types) q.append('types', t);
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    return `?${q}`;
  };
  return (
    <>
      <h2>Logs</h2>
      <form className="admin-filter" method="get">
        <input type="hidden" name="tab" value="Logs" />
        {TIMELINE_TYPES.filter((t) => !data.restrictedTypes.includes(t)).map((t) => (
          <label key={t}>
            <input type="checkbox" name="types" value={t} defaultChecked={types.includes(t)} /> {typeLabel[t]}
          </label>
        ))}
        <label>
          De
          <input type="date" name="from" defaultValue={from} />
        </label>
        <label>
          Até
          <input type="date" name="to" defaultValue={to} />
        </label>
        <button className="button small">Filtrar</button>
      </form>
      {data.restrictedTypes.length > 0 && (
        <p className="admin-warning">Sem permissão para: {data.restrictedTypes.map((t) => typeLabel[t]).join(', ')}.</p>
      )}
      <ol className="admin-timeline">
        {data.items.map((e) => (
          <li key={`${e.type}:${e.id}`}>
            <time dateTime={e.at}>{when(e.at)}</time> · <strong>{typeLabel[e.type]}</strong> ·{' '}
            {actionLabel[e.action] ?? e.action}
            {typeof e.detail.reason === 'string' && ` · ${e.detail.reason}`}
          </li>
        ))}
      </ol>
      {data.items.length === 0 && <p className="admin-empty">Nenhum evento para estes filtros.</p>}
      <div className="admin-pagination">
        {page > 1 && <Link href={url(page - 1)}>← Anterior</Link>}
        <span>{data.total} eventos</span>
        {page * data.pageSize < data.total && <Link href={url(page + 1)}>Próxima →</Link>}
      </div>
    </>
  );
}
