// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
const m = vi.hoisted(() => ({ activity: vi.fn() }));
vi.mock('@/lib/api/client', () => ({
  SuburbioApiClient: class {
    playerActivity = m.activity;
  },
}));
import { PlayerActivity, duration } from '@/components/admin/player-activity';
import { activitySchema } from '@/lib/api/activity-contracts';
afterEach(cleanup);
const id = '11111111-1111-4111-8111-111111111111';
const base = {
  playerId: id,
  firstSeenAt: '2026-09-11T02:00:00.000Z',
  lastSeenAt: '2026-09-11T05:00:00.000Z',
  totals: {
    today: 0,
    last7Days: 9000,
    last30Days: 9000,
    last90Days: 9000,
    thisMonth: 0,
    allTime: 12600,
    custom: 12600,
  },
  range: { from: '2026-09-10', to: '2026-09-11' },
  byDay: [
    { date: '2026-09-10', seconds: 3600 },
    { date: '2026-09-11', seconds: 9000 },
  ],
  byCharacter: [{ citizenId: 'AAA00010', cityId: 128, seconds: 10800 }],
  sessions: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      citizenId: 'AAA00010',
      cityId: 128,
      startedAt: '2026-09-11T02:00:00.000Z',
      endedAt: '2026-09-11T05:00:00.000Z',
      durationSeconds: 10800,
      endReason: 'timeout',
    },
  ],
  page: 1,
  pageSize: 25,
  total: 1,
};
const props = { discordId: '403707367885242378', playerId: id, page: 1, from: '2026-09-10', to: '2026-09-11' };

it('offline: último acesso, totais, gráfico com corte da meia-noite e histórico', async () => {
  m.activity.mockResolvedValue({ data: activitySchema.parse({ ...base, status: { online: false } }) });
  render(await PlayerActivity(props));
  expect(m.activity).toHaveBeenCalledWith(props.discordId, id, { from: '2026-09-10', to: '2026-09-11' }, 1);
  const text = document.body.textContent!;
  for (const t of [
    'OFFLINE',
    'Último acesso',
    'Todo período3h30',
    '2026-09-10 a 2026-09-113h30',
    '1h00',
    '2h30',
    'Sem sinal (queda)',
    'AAA00010 (ID 128)',
  ])
    expect(text).toContain(t);
});

it('online só quando a API afirma sessão aberta com sinal recente', async () => {
  m.activity.mockResolvedValue({
    data: activitySchema.parse({
      ...base,
      status: {
        online: true,
        since: '2026-09-11T02:00:00.000Z',
        citizenId: 'AAA00010',
        cityId: 128,
        lastSeenAt: '2026-09-11T04:17:00.000Z',
      },
    }),
  });
  render(await PlayerActivity(props));
  expect(document.body.textContent).toContain('ONLINE');
  expect(document.body.textContent).toContain('Online há 2h17');
  expect(document.body.textContent).toContain('ID 128');
});

it('formata duração em horas e minutos', () => {
  expect(duration(0)).toBe('0h00');
  expect(duration(15120)).toBe('4h12');
  expect(duration(31260)).toBe('8h41');
});
