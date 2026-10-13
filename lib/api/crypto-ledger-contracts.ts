import { z } from 'zod';
// Espelha GET /internal/site/players/:id/crypto (wallet única da API). Valores inteiros como string.
const amount = z.string().regex(/^\d+$/);
export const adminCryptoSchema = z.object({
  playerId: z.uuid(),
  balance: amount,
  totals: z.object({
    purchased: amount,
    gifted: amount,
    adminCredited: amount,
    adminDebited: amount,
    spent: amount,
    refunded: amount,
    compensated: amount,
  }),
  items: z
    .array(
      z.object({
        id: z.uuid(),
        playerId: z.uuid(),
        type: z.enum([
          'PURCHASE_CREDIT',
          'GIFT_CREDIT',
          'ADMIN_CREDIT',
          'ADMIN_DEBIT',
          'PURCHASE_DEBIT',
          'PURCHASE_REFUND',
          'FULFILLMENT_COMPENSATION',
        ]),
        direction: z.enum(['credit', 'debit']),
        amount,
        balanceBefore: amount,
        balanceAfter: amount,
        origin: z.enum(['site', 'in-game', 'admin', 'refund', 'gift']),
        reference: z.object({ orderId: z.uuid().nullable(), operationId: z.uuid() }),
        createdAt: z.iso.datetime(),
      }),
    )
    .max(100),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type AdminCrypto = z.infer<typeof adminCryptoSchema>;
