import { z } from 'zod';
export const entitlementSchema = z.object({
  id: z.uuid(),
  playerId: z.uuid().nullable(),
  productId: z.string(),
  productName: z.string(),
  orderId: z.uuid(),
  orderItemId: z.uuid(),
  fulfillmentId: z.uuid(),
  type: z.string(),
  status: z.enum(['PENDING', 'ACTIVE', 'EXPIRED', 'REVOKED']),
  startsAt: z.iso.datetime().nullable(),
  expiresAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  activatedAt: z.iso.datetime().nullable(),
  expiredAt: z.iso.datetime().nullable(),
  revokedAt: z.iso.datetime().nullable(),
  revision: z.number().int(),
  origin: z.enum(['SITE_VIP', 'INGAME']),
});
export const entitlementsPage = z.object({
  items: z.array(entitlementSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  asOf: z.iso.datetime(),
});
