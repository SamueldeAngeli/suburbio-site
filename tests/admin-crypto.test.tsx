// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
const m = vi.hoisted(() => ({ crypto: vi.fn() }));
vi.mock('@/lib/api/client', () => ({
  SuburbioApiClient: class {
    playerCrypto = m.crypto;
  },
}));
import { PlayerCrypto } from '@/components/admin/player-crypto';
import { adminCryptoSchema } from '@/lib/api/crypto-ledger-contracts';
import { SiteError } from '@/lib/api/errors';
afterEach(cleanup);
const id = '11111111-1111-4111-8111-111111111111';
const data = adminCryptoSchema.parse({
  playerId: id,
  balance: '70',
  totals: {
    purchased: '100',
    gifted: '0',
    adminCredited: '0',
    adminDebited: '0',
    spent: '30',
    refunded: '0',
    compensated: '0',
  },
  items: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      playerId: id,
      type: 'PURCHASE_DEBIT',
      direction: 'debit',
      amount: '30',
      balanceBefore: '100',
      balanceAfter: '70',
      origin: 'in-game',
      reference: {
        orderId: '33333333-3333-4333-8333-333333333333',
        operationId: '44444444-4444-4444-8444-444444444444',
      },
      createdAt: '2026-10-13T12:00:00.000Z',
    },
  ],
  page: 1,
  pageSize: 25,
  total: 1,
});

it('mostra saldo, totais e movimentação com origem e saldos antes/depois', async () => {
  m.crypto.mockResolvedValue({ data });
  render(await PlayerCrypto({ discordId: '403707367885242378', playerId: id, page: 1 }));
  expect(m.crypto).toHaveBeenCalledWith('403707367885242378', id, 1);
  for (const text of [
    'Saldo atual70',
    'Comprado100',
    'Gasto30',
    'Compra com Crypto',
    '−30',
    'In-game',
    'Pedido 33333333',
  ])
    expect(document.body.textContent).toContain(text);
});

it('sem permissão financeira mostra erro, sem saldo', async () => {
  m.crypto.mockRejectedValue(new SiteError('ADMIN_CAPABILITY_REQUIRED', 403));
  render(await PlayerCrypto({ discordId: '403707367885242378', playerId: id, page: 1 }));
  expect(screen.queryByText('Saldo atual')).toBeNull();
});
