import { pageAccess } from '@/lib/permissions/guards';
import { can } from '@/lib/permissions/policy';
import { safeError } from '@/lib/api/errors';
import { moderationOverview, SCREEN_MODERATION_CAPABILITY, SCREEN_MODERATION_READ } from '@/lib/screen/rooms';
import { AccessUnavailable, ErrorState } from '@/components/admin/states';
import { EndBroadcast } from '@/components/admin/broadcast-moderation';
import { CATEGORY_LABEL, elapsed } from '@/lib/screen/room-client';

export const dynamic = 'force-dynamic';
const STATUS = { live: 'Ao vivo', paused: 'Pausada', waiting: 'Aguardando tela' } as const;
const REASON = {
  host: 'Pelo transmissor',
  moderator: 'Pela moderação',
  host_lost: 'Transmissor não voltou',
  closed: 'Sala vazia',
  expired: 'Expirada',
} as const;
const when = (ms: number) => new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export default async function Transmissions() {
  const admin = await pageAccess(SCREEN_MODERATION_READ, '/admin/transmissoes');
  if (!admin) return <AccessUnavailable />;
  const moderate = can(admin, SCREEN_MODERATION_CAPABILITY);
  let data: Awaited<ReturnType<typeof moderationOverview>>;
  try {
    data = await moderationOverview();
  } catch (error) {
    const e = safeError(error);
    return <ErrorState message={e.body.error.message} reference={e.body.error.reference} />;
  }
  const now = Date.now();
  return (
    <>
      <div className="admin-title">
        <span className="admin-kicker">COMUNIDADE / TELA</span>
        <h1>
          Transmissões<span>.</span>
        </h1>
        <p>
          Abertas agora (inclusive privadas) e encerradas recentemente. Contagens vêm da LiveKit no momento da leitura.
        </p>
      </div>
      <div className="admin-panel">
        <div className="admin-panel-title">
          <h2>Abertas agora</h2>
          <span className="admin-badge">{data.open.length}</span>
        </div>
        {data.open.length === 0 ? (
          <p className="admin-empty">Nenhuma transmissão aberta.</p>
        ) : (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Transmissor</th>
                  <th>Estado</th>
                  <th>Início</th>
                  <th>Duração</th>
                  <th>Assistindo</th>
                  <th>Visibilidade</th>
                  {moderate && <th>Ação</th>}
                </tr>
              </thead>
              <tbody>
                {data.open.map((b) => (
                  <tr key={b.code}>
                    <td>
                      {b.title}
                      {b.category && <small> · {CATEGORY_LABEL[b.category]}</small>}
                    </td>
                    <td>
                      {b.hostName}
                      <br />
                      <small className="admin-id">{b.host}</small>
                    </td>
                    <td>
                      {STATUS[b.status]}
                      {!b.hostConnected && b.status !== 'waiting' && <small> · transmissor ausente</small>}
                    </td>
                    <td>{b.startedAt ? when(b.startedAt) : '—'}</td>
                    <td>{b.startedAt ? elapsed(b.startedAt, now) : '—'}</td>
                    <td>
                      {b.viewers}
                      {b.peakViewers > b.viewers && <small> (pico {b.peakViewers})</small>}
                    </td>
                    <td>{b.visibility === 'private' ? 'Privada' : 'Pública'}</td>
                    {moderate && (
                      <td>
                        <EndBroadcast code={b.code} title={b.title} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="admin-panel">
        <div className="admin-panel-title">
          <h2>Encerradas recentemente</h2>
        </div>
        {data.ended.length === 0 ? (
          <p className="admin-empty">Nenhuma transmissão encerrada registrada nos últimos dias.</p>
        ) : (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Transmissor</th>
                  <th>Início</th>
                  <th>Duração</th>
                  <th>Pico</th>
                  <th>Encerramento</th>
                </tr>
              </thead>
              <tbody>
                {data.ended.map((e) => (
                  <tr key={e.code + e.endedAt}>
                    <td>{e.title}</td>
                    <td>{e.hostName}</td>
                    <td>{when(e.startedAt)}</td>
                    <td>{elapsed(e.startedAt, e.endedAt)}</td>
                    <td>{e.peakViewers}</td>
                    <td>
                      {REASON[e.reason]} · {when(e.endedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!moderate && (
        <p className="admin-note">
          Encerrar transmissões de terceiros exige a permissão {SCREEN_MODERATION_CAPABILITY}.
        </p>
      )}
    </>
  );
}
