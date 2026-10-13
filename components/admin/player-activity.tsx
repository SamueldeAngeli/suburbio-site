import Link from 'next/link';
import { SuburbioApiClient } from '@/lib/api/client';
import { safeError } from '@/lib/api/errors';
import { ErrorState } from './states';

const TZ = 'America/Sao_Paulo';
export const duration = (seconds: number) => {
  const h = Math.floor(seconds / 3600),
    m = Math.floor((seconds % 3600) / 60);
  return `${h}h${String(m).padStart(2, '0')}`;
};
const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: TZ });
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const weekday = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'short' }).replace('.', '');
const reasons = {
  quit: 'Saída',
  character_switch: 'Troca de personagem',
  server_stop: 'Servidor parado',
  server_restart: 'Reinício do servidor',
  timeout: 'Sem sinal (queda)',
  invalidated: 'Saída sem aviso',
  superseded: 'Nova sessão',
} as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Tempo jogado/presença (PLAYERS_READ na API). ONLINE só com sessão aberta + sinal recente.
export async function PlayerActivity({
  discordId,
  playerId,
  page,
  from,
  to,
}: {
  discordId: string;
  playerId: string;
  page: number;
  from?: string;
  to?: string;
}) {
  const range = from && to && DATE.test(from) && DATE.test(to) ? { from, to } : null;
  let data;
  try {
    data = (await new SuburbioApiClient().playerActivity(discordId, playerId, range, page)).data;
  } catch (error) {
    const e = safeError(error).body.error;
    return <ErrorState message={e.message} reference={e.reference} />;
  }
  const t = data.totals;
  const max = Math.max(1, ...data.byDay.map((d) => d.seconds));
  const pageUrl = (p: number) => `?${new URLSearchParams({ tab: 'Atividade', page: String(p), ...(range ?? {}) })}`;
  return (
    <>
      <h2>Atividade</h2>
      <div className="admin-record" role="status">
        {data.status.online ? (
          <p>
            <span className="admin-badge">ONLINE</span> Online há{' '}
            {duration(
              Math.max(0, Math.floor((Date.parse(data.status.lastSeenAt) - Date.parse(data.status.since)) / 1000)),
            )}
            {' · '}Personagem {data.status.citizenId}
            {data.status.cityId !== null && ` · ID ${data.status.cityId}`}
          </p>
        ) : (
          <p>
            <span className="admin-badge">OFFLINE</span>{' '}
            {data.lastSeenAt ? `Último acesso: ${when(data.lastSeenAt)}` : 'Nenhuma sessão registrada'}
          </p>
        )}
        <p>
          Primeiro acesso: {data.firstSeenAt ? when(data.firstSeenAt) : '—'} · Último acesso:{' '}
          {data.lastSeenAt ? when(data.lastSeenAt) : '—'}
        </p>
      </div>
      <div className="admin-metrics">
        {[
          ['Hoje', t.today],
          ['Últimos 7 dias', t.last7Days],
          ['Últimos 30 dias', t.last30Days],
          ['Últimos 90 dias', t.last90Days],
          ['Este mês', t.thisMonth],
          ['Todo período', t.allTime],
          ...(t.custom !== null && range ? [[`${range.from} a ${range.to}`, t.custom] as const] : []),
        ].map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{duration(value as number)}</strong>
          </article>
        ))}
      </div>
      <form className="admin-filter" method="get">
        <input type="hidden" name="tab" value="Atividade" />
        <label>
          Data inicial
          <input type="date" name="from" defaultValue={range?.from} required />
        </label>
        <label>
          Data final
          <input type="date" name="to" defaultValue={range?.to} required />
        </label>
        <button className="button small">Personalizar</button>
        {range && <Link href="?tab=Atividade">Últimos 7 dias</Link>}
      </form>
      <h3>Horas jogadas por dia</h3>
      <div className="admin-activity-chart" role="img" aria-label="Horas jogadas por dia">
        {data.byDay.map((d) => (
          <div key={d.date} title={`${d.date}: ${duration(d.seconds)}`}>
            <span className="admin-activity-bar" style={{ height: `${Math.round((d.seconds / max) * 100)}%` }} />
            <small>
              {weekday(d.date)} {duration(d.seconds)}
            </small>
          </div>
        ))}
      </div>
      <h3>Tempo por personagem</h3>
      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Personagem</th>
              <th>ID</th>
              <th>Tempo total</th>
            </tr>
          </thead>
          <tbody>
            {data.byCharacter.map((c) => (
              <tr key={c.citizenId}>
                <td>{c.citizenId}</td>
                <td>{c.cityId ?? '—'}</td>
                <td>{duration(c.seconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Histórico de sessões</h3>
      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Entrada</th>
              <th>Saída</th>
              <th>Duração</th>
              <th>Personagem</th>
              <th>Encerramento</th>
            </tr>
          </thead>
          <tbody>
            {data.sessions.map((s) => (
              <tr key={s.id}>
                <td>{new Date(s.startedAt).toLocaleDateString('pt-BR', { timeZone: TZ })}</td>
                <td>{time(s.startedAt)}</td>
                <td>{s.endedAt ? time(s.endedAt) : 'Em andamento'}</td>
                <td>{duration(s.durationSeconds)}</td>
                <td>
                  {s.citizenId}
                  {s.cityId !== null && ` (ID ${s.cityId})`}
                </td>
                <td>{s.endReason ? reasons[s.endReason] : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.sessions.length === 0 && <p className="admin-empty">Nenhuma sessão registrada.</p>}
      <div className="admin-pagination">
        {page > 1 && <Link href={pageUrl(page - 1)}>← Anterior</Link>}
        <span>{data.total} sessões</span>
        {page * data.pageSize < data.total && <Link href={pageUrl(page + 1)}>Próxima →</Link>}
      </div>
    </>
  );
}
