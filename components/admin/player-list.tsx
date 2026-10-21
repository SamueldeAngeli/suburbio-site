import Link from 'next/link';
import { z } from 'zod';
import { pageAccess } from '@/lib/permissions/guards';
import { SuburbioApiClient } from '@/lib/api/client';
import { safeError } from '@/lib/api/errors';
import { AccessUnavailable, ErrorState } from './states';
import { discordLabel } from './discord-identity';

const filters = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  q: z.string().trim().max(100).default(''),
});
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
const role = (r: { label: string; grade: string | null } | null) =>
  r ? (r.grade ? `${r.label} · ${r.grade}` : r.label) : '—';
const allowlistLabel = { active: 'Ativa', revoked: 'Revogada', none: 'Sem allowlist' } as const;

// Lista de jogadores (PLAYERS_READ). cityId é o identificador principal; o UUID interno não aparece.
export async function PlayerList({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await pageAccess('PLAYERS_READ', '/admin/players');
  if (!admin) return <AccessUnavailable />;
  const parsed = filters.safeParse(await searchParams);
  if (!parsed.success) return <ErrorState message="Filtros inválidos." />;
  const query = parsed.data;
  let result;
  try {
    result = (await new SuburbioApiClient().players(admin.discordId, query.page, query.q)).data;
  } catch (error) {
    const safe = safeError(error);
    return <ErrorState message={safe.body.error.message} reference={safe.body.error.reference} />;
  }
  const pageUrl = (page: number) => `/admin/players?${new URLSearchParams({ page: String(page), q: query.q })}`;
  return (
    <>
      <div className="admin-title">
        <span className="admin-kicker">GESTÃO / JOGADORES</span>
        <h1>Jogadores</h1>
        <p>Pessoas e histórias que fazem o Subúrbio acontecer.</p>
      </div>
      <form className="admin-filter">
        <label>
          Buscar
          <input
            name="q"
            maxLength={100}
            defaultValue={query.q}
            placeholder="ID da cidade, nome, Discord, citizenId, license: ou steam:"
          />
        </label>
        <button className="button small">Buscar</button>
      </form>
      <div className="admin-panel">
        <div className="admin-panel-title">
          <h2>Personagens da cidade</h2>
          <span className="admin-badge">
            {result.total} {result.total === 1 ? 'registro' : 'registros'}
          </span>
        </div>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Discord</th>
                <th>Citizen ID</th>
                <th>Emprego</th>
                <th>Organização</th>
                <th>Em mãos / Banco</th>
                <th>Status</th>
                <th>Allowlist</th>
                <th>VIP</th>
                <th>Última atividade</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((p) => (
                <tr key={p.citizenId}>
                  <td data-label="ID">
                    <strong>{p.cityId}</strong>
                  </td>
                  <td data-label="Nome">
                    {p.playerId ? (
                      <Link href={`/admin/players/${p.playerId}`}>{p.name ?? p.accountName}</Link>
                    ) : (
                      (p.name ?? p.accountName)
                    )}
                  </td>
                  <td data-label="Discord">
                    {p.discordId
                      ? `${discordLabel(p.discordId, p.discordName)}${p.discordVerified ? '' : ' (não verificado)'}`
                      : 'Não vinculado'}
                  </td>
                  <td data-label="Citizen ID">{p.citizenId}</td>
                  <td data-label="Emprego">{role(p.job)}</td>
                  <td data-label="Organização">{role(p.gang)}</td>
                  <td data-label="Em mãos / Banco">
                    {p.money ? `${brl(p.money.cash)} / ${brl(p.money.bank)}` : 'Indisponível'}
                  </td>
                  {/* ONLINE = sessão aberta + sinal recente; sem vínculo na API = desconhecido. */}
                  <td data-label="Status">
                    {p.online === null ? (
                      '—'
                    ) : (
                      <span className={`admin-state state-${p.online ? 'active' : 'disabled'}`}>
                        {p.online ? 'Online' : 'Offline'}
                      </span>
                    )}
                  </td>
                  <td data-label="Allowlist">{p.allowlist ? allowlistLabel[p.allowlist] : 'Sem vínculo na API'}</td>
                  <td data-label="VIP">{p.vip === null ? '—' : p.vip ? 'Ativo' : 'Não'}</td>
                  <td data-label="Última atividade">
                    {new Date(p.lastActivity).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                      timeZone: 'America/Sao_Paulo',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {result.items.length === 0 && <p className="admin-empty">Nenhum jogador encontrado para esta busca.</p>}
        <div className="admin-pagination">
          <span>Página {result.page}</span>
          {result.page > 1 && <Link href={pageUrl(result.page - 1)}>Anterior</Link>}
          {result.page * result.pageSize < result.total && <Link href={pageUrl(result.page + 1)}>Próxima</Link>}
        </div>
      </div>
    </>
  );
}
