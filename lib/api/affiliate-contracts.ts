import { z } from 'zod';
import { discordIdSchema as discordId } from './contracts';
export const affiliateCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{3,32}$/);
export const affiliateInput = z
  .object({
    discordId,
    name: z.string().trim().min(2).max(100),
    couponName: z.string().trim().min(2).max(100),
    code: affiliateCode,
    discountPercent: z.number().int().min(0).max(99),
    commissionPercent: z.number().int().min(0).max(100),
    holdDays: z.number().int().min(0).max(365),
    status: z.enum(['ACTIVE', 'DISABLED', 'SUSPENDED', 'CLOSED']),
    type: z.enum(['STAFF', 'STREAMER', 'CREATOR', 'PARTNER', 'OTHER']),
    expiresAt: z.iso.datetime().nullable(),
    notes: z.string().max(2000),
  })
  .strict();
export const affiliateSchema = affiliateInput.extend({
  id: z.uuid(),
  couponId: z.uuid(),
  revision: z.number().int(),
  createdAt: z.iso.datetime(),
});
export const publicAffiliate = affiliateSchema
  .omit({ discordId: true, notes: true, couponId: true, revision: true })
  .strip();
export const periodSchema = z.enum(['7', '30', '90', 'all']).default('30');
export const money = z.string().regex(/^\d+$/);
export const attributionSchema = z.object({
  affiliateId: z.uuid(),
  affiliateCode,
  discountRateApplied: z.number().int(),
  commissionRateApplied: z.number().int(),
  commissionBaseAmount: money,
  commissionAmount: money,
  holdDays: z.number().int(),
  selfPurchase: z.boolean(),
  buyerDiscordId: discordId,
  attributedAt: z.iso.datetime(),
});
export const saleSchema = z.object({
  orderId: z.uuid(),
  approvedAt: z.iso.datetime(),
  availableAt: z.iso.datetime(),
  products: z.array(z.object({ name: z.string(), quantity: z.number().int() })),
  paidMinor: money,
  commissionMinor: money,
  originalMinor: money,
  reversedMinor: money,
  debtMinor: money,
  status: z.enum(['PENDING', 'AVAILABLE', 'PAID', 'REVERSED']),
  affiliateCode,
  discountRateApplied: z.number().int(),
  commissionRateApplied: z.number().int(),
});
export const dashboardSchema = z.object({
  affiliate: publicAffiliate,
  period: periodSchema,
  asOf: z.iso.datetime(),
  summary: z.object({
    soldMinor: money,
    generatedMinor: money,
    pendingMinor: money,
    availableMinor: money,
    paidMinor: money,
    reversedMinor: money,
    debtMinor: money,
    purchases: z.number().int(),
    buyers: z.number().int(),
  }),
  chart: z.array(z.object({ date: z.string(), soldMinor: money, commissionMinor: money })),
  sales: z.array(saleSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export const payoutSchema = z.object({
  id: z.uuid(),
  grossMinor: money,
  offsetMinor: money,
  amountMinor: money,
  actorDiscordId: discordId,
  note: z.string(),
  createdAt: z.iso.datetime(),
});
export const affiliateMutation = z
  .object({
    affiliate: affiliateInput,
    reason: z.string().trim().min(5).max(500),
    confirm: z.literal(true),
    expectedRevision: z.number().int().positive().optional(),
  })
  .strict();
export const payoutInput = z
  .object({
    orderIds: z
      .array(z.uuid())
      .min(1)
      .max(100)
      .refine((v) => new Set(v).size === v.length),
    expectedAmountMinor: money,
    note: z.string().trim().min(5).max(1000),
    confirm: z.literal(true),
  })
  .strict();
export type AffiliateInput = z.infer<typeof affiliateInput>;
