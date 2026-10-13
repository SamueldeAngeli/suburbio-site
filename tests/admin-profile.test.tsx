// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
const m = vi.hoisted(() => ({
  overview: vi.fn(),
  characters: vi.fn(),
  purchases: vi.fn(),
  punishments: vi.fn(),
  timeline: vi.fn(),
  access: vi.fn(),
}));
vi.mock('@/lib/api/client', () => ({
  SuburbioApiClient: class {
    playerOverview = m.overview;
    playerCharacters = m.characters;
    playerPurchases = m.purchases;
    playerPunishments = m.punishments;
    playerTimeline = m.timeline;
  },
}));
vi.mock('@/lib/permissions/guards', () => ({ pageAccess: m.access }));
vi.mock('@/components/order-stages', () => ({ OrderStages: () => null }));
import {
  PlayerOverview,
  PlayerPurchases,
  PlayerPunishments,
  PlayerTimeline,
  PlayerCharacters,
} from '@/components/admin/player-profile-tabs';
import { DetailPage } from '@/components/admin/detail-page';
import { DiscordIdentityCard, discordLabel } from '@/components/admin/discord-identity';
import {
  overviewSchema,
  purchasesSchema,
  punishmentsSchema,
  timelineSchema,
  charactersAdminSchema,
} from '@/lib/api/player-profile-contracts';

const playerId = '11111111-1111-4111-8111-111111111111';
const props = { discordId: '403707367885242378', playerId };
const discord = {
  discordId: '403707367885242378',
  name: 'Samuel',
  displayName: 'Samuel',
  guildNickname: 'Samuca',
  username: 'samuel',
  avatarHash: null,
  observedAt: '2026-10-13T10:00:00.000Z',
};
const restricted = { available: false, reason: 'RESTRICTED' };
const emptyOverview = {
  playerId,
  status: { online: false },
  identity: {
    characterName: null,
    cityId: null,
    citizenId: null,
    discord: null,
    steam: null,
    fivem: null,
    license: restricted,
  },
  firstSeenAt: null,
  lastSeenAt: null,
  summary: {
    playtimeSeconds: 0,
    characters: { available: false, reason: 'UNAVAILABLE' },
    spent: restricted,
    cryptoBalance: restricted,
    punishments: restricted,
    allowlist: 'none',
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  m.access.mockResolvedValue({ discordId: props.discordId });
});
afterEach(cleanup);

it('Discord: nome humano, apelido, @username e ID só abreviado', () => {
  render(<DiscordIdentityCard identity={discord} />);
  const text = document.body.textContent!;
  for (const t of ['Samuel', 'Apelido no Subúrbio: Samuca', '@samuel', 'ID: 403707…']) expect(text).toContain(t);
  expect(text).not.toContain('403707367885242378');
  expect(discordLabel('403707367885242378', null)).toBe('ID 403707…');
});

it('visão geral: online com servidor; seções sem permissão aparecem como tal, nunca zero', async () => {
  m.overview.mockResolvedValue({
    data: overviewSchema.parse({
      ...emptyOverview,
      status: {
        online: true,
        since: '2026-10-13T10:00:00.000Z',
        citizenId: 'AAA00001',
        cityId: 128,
        serverId: 'main',
        lastSeenAt: '2026-10-13T12:17:00.000Z',
      },
      identity: { ...emptyOverview.identity, characterName: 'Ana Souza', cityId: 128, citizenId: 'AAA00001', discord },
      summary: {
        ...emptyOverview.summary,
        playtimeSeconds: 7200,
        characters: { available: true, count: 2 },
        allowlist: 'active',
      },
    }),
  });
  render(await PlayerOverview(props));
  const text = document.body.textContent!;
  for (const t of [
    'ONLINE',
    'Online há 2h17',
    'Servidor main',
    'Ana Souza',
    'Personagens2',
    'Gasto (BRL)Sem permissão',
    'Saldo CryptoSem permissão',
    'LicenseSem permissão',
    'SteamNão informado',
  ])
    expect(text).toContain(t);
  expect(text).not.toMatch(/R\$\s?0,00/);
});

it('compras: gasto em BRL e em Crypto separados; produto e origem', async () => {
  m.purchases.mockResolvedValue({
    data: purchasesSchema.parse({
      items: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          salesChannel: 'INGAME',
          paymentMethod: 'CRYPTO',
          storefront: null,
          status: 'completed',
          paymentStatus: 'approved',
          deliveryStatus: 'delivered',
          reservationStatus: 'none',
          grossAmountMinor: '300',
          discountAmountMinor: '0',
          netAmountMinor: '300',
          currency: 'CRYPTO',
          createdAt: '2026-10-13T10:00:00.000Z',
          expiresAt: null,
          products: [{ name: 'VIP Ouro', quantity: 1 }],
          couponCode: null,
        },
      ],
      totals: { brlApprovedMinor: '12000', cryptoApproved: '300' },
      page: 1,
      pageSize: 25,
      total: 1,
    }),
  });
  render(await PlayerPurchases({ ...props, page: 1 }));
  const text = document.body.textContent!;
  for (const t of ['Gasto aprovado em BRLR$', 'Gasto aprovado em Crypto300', '1× VIP Ouro', 'In-game'])
    expect(text).toContain(t);
});

it('punições: fonte da cidade, sem data/status inventados', async () => {
  m.punishments.mockResolvedValue({
    data: punishmentsSchema.parse({
      playerId,
      source: 'qbcore-bans',
      complete: false,
      legacyBlocked: true,
      items: [
        {
          id: '7',
          type: 'BAN',
          reason: 'RDM',
          responsible: 'Staff X',
          createdAt: null,
          expireRaw: 2147483647,
          status: 'UNCONFIRMED',
          origin: 'qbcore',
        },
      ],
    }),
  });
  render(await PlayerPunishments(props));
  const text = document.body.textContent!;
  for (const t of ['RDM', 'Staff X', 'Não confirmado', 'unidade não confirmada', 'Bloqueado'])
    expect(text).toContain(t);
});

it('logs: tipos restritos informados e fora dos filtros', async () => {
  m.timeline.mockResolvedValue({
    data: timelineSchema.parse({
      playerId,
      items: [{ id: 's1:start', at: '2026-10-13T10:00:00.000Z', type: 'session', action: 'connected', detail: {} }],
      restrictedTypes: ['crypto', 'admin'],
      page: 1,
      pageSize: 50,
      total: 1,
    }),
  });
  render(await PlayerTimeline({ ...props, page: 1, types: [] }));
  const text = document.body.textContent!;
  expect(text).toContain('Entrou na cidade');
  expect(text).toContain('Sem permissão para: Crypto, Ação administrativa');
  expect(document.querySelector('input[value="crypto"]')).toBeNull();
});

it('personagens: vários personagens com status, tempo e criação indisponível', async () => {
  const base = { job: null, gang: null, money: null, createdAt: null, lastUpdatedAt: '2026-10-01T10:00:00.000Z' };
  m.characters.mockResolvedValue({
    data: charactersAdminSchema.parse({
      playerId,
      items: [
        {
          ...base,
          cityId: 128,
          citizenId: 'AAA00001',
          name: 'Ana Souza',
          online: true,
          lastAccessAt: '2026-10-13T10:00:00.000Z',
          playtimeSeconds: 3600,
          job: { label: 'Polícia', grade: 'Cabo' },
        },
        {
          ...base,
          cityId: 129,
          citizenId: 'AAA00002',
          name: 'Ana Lima',
          online: false,
          lastAccessAt: null,
          playtimeSeconds: 0,
        },
      ],
    }),
  });
  render(await PlayerCharacters(props));
  const text = document.body.textContent!;
  for (const t of [
    'Ana Souza',
    'ID 128',
    'Online',
    'Ana Lima',
    'Offline',
    'Sem sessão registrada',
    'Indisponível na base da cidade',
  ])
    expect(text).toContain(t);
});

it('abas carregam só os próprios dados (lazy) e o UUID não aparece no cabeçalho', async () => {
  // A página devolve só o componente da aba ativa; os demais nem são montados.
  const tree = await DetailPage({ kind: 'players', id: playerId, tab: 'Visão geral' });
  const types: unknown[] = [];
  const texts: string[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node === 'string' || typeof node === 'number') texts.push(String(node));
    if (node && typeof node === 'object' && 'type' in node) {
      types.push((node as { type: unknown }).type);
      walk((node as { props?: { children?: unknown } }).props?.children);
    }
  };
  walk(tree);
  expect(types).toContain(PlayerOverview);
  for (const other of [PlayerCharacters, PlayerPurchases, PlayerPunishments, PlayerTimeline])
    expect(types).not.toContain(other);
  // Nenhuma consulta da ficha acontece antes da aba ser renderizada.
  for (const fn of [m.overview, m.characters, m.purchases, m.punishments, m.timeline])
    expect(fn).not.toHaveBeenCalled();
  expect(texts.join(' ')).not.toContain(playerId);
});
