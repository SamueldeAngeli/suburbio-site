import { SuburbioApiClient } from '@/lib/api/client';
import { safeError } from '@/lib/api/errors';
import { actionLabel, formatCell } from '@/lib/admin/lists';
import { ErrorState } from './states';

const firstPage = { page: 1, pageSize: 20, q: '', status: '', from: '', to: '' };

/** Números da visão geral, direto do PostgreSQL da API (DASHBOARD_READ). */
export async function DashboardMetrics({ actor }: { actor: string }) {
  try {
    const { data } = await new SuburbioApiClient().adminList(actor, 'dashboard', firstPage);
    return (
      <div className="admin-metrics">
        {data.items.map((m) => (
          <article key={String(m.id)}>
            <span>{String(m.label)}</span>
            <strong>
              {m.currency
                ? formatCell(m, { key: 'value', label: '', format: 'money', currencyKey: 'currency' })
                : Number(m.value).toLocaleString('pt-BR')}
            </strong>
            <small>{m.id === 'ordersToday' || m.id === 'revenueToday' ? 'Desde 00h (Brasília)' : 'Total atual'}</small>
          </article>
        ))}
      </div>
    );
  } catch (error) {
    const e = safeError(error);
    return <ErrorState message={e.body.error.message} reference={e.body.error.reference} />;
  }
}

/** Últimas ações administrativas (AUDIT_READ). */
export async function RecentActivity({ actor }: { actor: string }) {
  try {
    const { data } = await new SuburbioApiClient().adminList(actor, 'audit', firstPage);
    if (!data.items.length) return <p className="admin-empty">Nenhuma ação administrativa registrada ainda.</p>;
    return (
      <ul className="admin-activity">
        {data.items.slice(0, 8).map((a) => (
          <li key={String(a.id)}>
            <strong title={String(a.action)}>{actionLabel(String(a.action))}</strong>
            <span>
              {actionLabel(String(a.targetType))} ·{' '}
              {a.actorDiscordId
                ? `por ${String(a.actorDiscordIdName ?? `Discord ${String(a.actorDiscordId).slice(0, 6)}…`)}`
                : actionLabel(String(a.service))}
            </span>
            <time dateTime={String(a.createdAt)}>{formatCell(a, { key: 'createdAt', label: '', format: 'date' })}</time>
          </li>
        ))}
      </ul>
    );
  } catch (error) {
    const e = safeError(error);
    return <ErrorState message={e.body.error.message} reference={e.body.error.reference} />;
  }
}
