import { z } from 'zod';
export const uuid = z.uuid();
export const discordIdSchema = z.string().regex(/^\d{17,20}$/);
export const adminResolutionSchema = z.object({
  adminAccountId: uuid,
  discordId: discordIdSchema,
  status: z.literal('active'),
  isSystemOwner: z.boolean(),
  capabilities: z.array(z.string().max(64)).max(200),
  readOnly: z.boolean(),
});
export const adminSummarySchema = z.object({
  adminAccountId: uuid,
  discordId: discordIdSchema.nullable(),
  status: z.enum(['active', 'disabled']),
  isSystemOwner: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const adminListSchema = z.object({
  items: z.array(adminSummarySchema).max(100),
  page: z.number().int().positive(),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().nonnegative(),
});
export const healthSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  api: z.literal('suburbio-api'),
  postgres: z.enum(['up', 'down']),
  redis: z.enum(['up', 'down']),
  uptime: z.number().nonnegative(),
  version: z.string().max(50),
});
export const internalHealthSchema = healthSchema.extend({
  mysql: z.enum(['disabled', 'up', 'down']),
  'discord-bot': z.literal('unmonitored'),
  'fivem-bridge': z.literal('unmonitored'),
});
export const allowlistSchema = z.object({
  allowlist_id: uuid,
  player_id: uuid,
  status: z.enum(['active', 'revoked']),
  updated_at: z.iso.datetime(),
});
export const revokeInputSchema = z
  .object({
    playerId: uuid,
    reason: z.string().trim().min(3).max(500),
    confirmed: z.literal(true),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9:_-]{8,128}$/),
  })
  .strict();
export const revokeResultSchema = z.object({
  playerId: uuid,
  allowlistId: uuid,
  status: z.literal('revoked'),
  operationId: uuid,
});
export const operationSchema = z.object({
  operation_id: uuid,
  type: z.string(),
  status: z.string(),
  correlation_id: uuid,
  error_code: z.string().nullable(),
  created_at: z.iso.datetime(),
  completed_at: z.iso.datetime().nullable(),
  failed_at: z.iso.datetime().nullable(),
});
export type InternalHealth = z.infer<typeof internalHealthSchema>;
export type Allowlist = z.infer<typeof allowlistSchema>;
export type RevokeInput = z.infer<typeof revokeInputSchema>;

// Site-facing DTO, NOT a claim that a corresponding HTTP endpoint exists.
export type AdminPrincipal = {
  adminAccountId: string;
  discordId: string;
  displayName: string;
  status: 'active' | 'disabled';
  accessLevel: string;
  capabilities: readonly string[];
  fullAccess: boolean;
  readOnly: boolean;
};
export type AccountResolution = { admin: AdminPrincipal | null; playerId: string | null };
export type PageResult<T> = { items: T[]; page: number; pageSize: number; total: number };
export type PlayerSummary = { playerId: string; name: string; discordId: string | null };
export type OrderSummary = {
  orderId: string;
  playerId: string;
  productName: string;
  quantity: number;
  amountMinor: number;
  currency: string;
  paymentStatus: string;
  deliveryStatus: string;
  createdAt: string;
};
export type PaymentSummary = {
  paymentId: string;
  orderId: string;
  provider: string;
  amountMinor: number;
  currency: string;
  status: string;
  createdAt: string;
  approvedAt: string | null;
  refundedAt: string | null;
};
export type AuditEntry = {
  operationId: string;
  actor: string;
  action: string;
  target: string;
  module: string;
  createdAt: string;
};
