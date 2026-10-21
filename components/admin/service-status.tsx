import { SuburbioApiClient } from '@/lib/api/client';
import { safeError } from '@/lib/api/errors';
import { ErrorState } from './states';
const STATE: Record<string, string> = {
  ok: 'Operacional',
  up: 'Operacional',
  down: 'Fora do ar',
  degraded: 'Instável',
  error: 'Com erro',
  unmonitored: 'Sem monitoramento',
};

export async function ServiceStatus() {
  try {
    const { data, trace } = await new SuburbioApiClient().health();
    const rows = [
      ['Subúrbio API', data.status],
      ['PostgreSQL', data.postgres],
      ['Redis', data.redis],
      ['MariaDB', data.mysql],
      ['Discord Bot', data['discord-bot']],
      ['FiveM Bridge', data['fivem-bridge']],
    ];
    return (
      <div className="admin-panel">
        <div className="admin-panel-title">
          <h2>Disponibilidade dos serviços</h2>
          <span className="admin-badge">API {data.version}</span>
        </div>
        <div className="admin-status-list">
          {rows.map(([name, state]) => (
            <div key={name}>
              <span>{name}</span>
              <strong className={`service-state state-${state}`} title={`Estado da API: ${state}`}>
                {STATE[String(state)] ?? state}
              </strong>
            </div>
          ))}
        </div>
        <p className="admin-note">
          “Sem monitoramento” significa que a API ainda não acompanha esse serviço — não que ele esteja fora do ar.
        </p>
        <p className="admin-trace">Correlação: {trace.correlationId}</p>
      </div>
    );
  } catch (error) {
    const e = safeError(error);
    return <ErrorState message={e.body.error.message} reference={e.body.error.reference} />;
  }
}
