// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const m = vi.hoisted(() => ({ access: vi.fn(), players: vi.fn() }));
vi.mock('@/lib/permissions/guards', () => ({ pageAccess: m.access }));
vi.mock('@/lib/api/client', () => ({
  SuburbioApiClient: class {
    players = m.players;
  },
}));
import { PlayerList } from '@/components/admin/player-list';
import { playerListSchema } from '@/lib/api/player-contracts';

const admin = { discordId: '403707367885242378' };
const page = {
  items: [
    {
      cityId: 128,
      citizenId: 'AAA00001',
      name: 'Ana Silva',
      accountName: 'conta',
      playerId: '11111111-1111-4111-8111-111111111111',
      discordId: '123456789012345678',
      discordName: 'Samuel',
      discordVerified: true,
      job: { label: 'Polícia', grade: 'Cabo' },
      gang: null,
      money: { cash: 10, bank: 20 },
      online: null,
      allowlist: 'active',
      vip: false,
      lastActivity: '2026-10-10T12:00:00.000Z',
    },
  ],
  page: 1,
  pageSize: 25,
  total: 1,
};
beforeEach(() => {
  vi.clearAllMocks();
  m.access.mockResolvedValue(admin);
  m.players.mockResolvedValue({ data: playerListSchema.parse(page) });
});
afterEach(cleanup);
const params = (q: Record<string, string> = {}) => ({ searchParams: Promise.resolve(q) });

it('exige PLAYERS_READ no servidor antes de consultar a API', async () => {
  m.access.mockResolvedValue(null);
  render(await PlayerList(params()));
  expect(m.access).toHaveBeenCalledWith('PLAYERS_READ', '/admin/players');
  expect(m.players).not.toHaveBeenCalled();
});

it('cityId é a primeira coluna; UUID interno não aparece; presença não é presumida', async () => {
  render(await PlayerList(params({ q: '128' })));
  expect(m.players).toHaveBeenCalledWith(admin.discordId, 1, '128');
  expect(screen.getAllByRole('columnheader')[0]!.textContent).toBe('ID');
  expect(screen.getAllByRole('cell')[0]!.textContent).toBe('128');
  expect(document.body.textContent).not.toContain(page.items[0]!.playerId);
  expect(document.body.textContent).not.toMatch(/offline/i);
  expect(document.body.textContent).toContain('Polícia · Cabo');
});
