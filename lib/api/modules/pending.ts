import 'server-only';
import type { PageResult, PlayerSummary, OrderSummary, PaymentSummary, AuditEntry } from '../contracts';
import { SiteError } from '../errors';
import { z } from 'zod';
export const listQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    q: z.string().trim().max(100).default(''),
    status: z.string().max(40).default(''),
    from: z.union([z.literal(''), z.iso.date()]).default(''),
    to: z.union([z.literal(''), z.iso.date()]).default(''),
  })
  .strict()
  .refine((v) => !v.from || !v.to || v.from <= v.to);
export type ListQuery = z.infer<typeof listQuerySchema>;
export interface PendingServices {
  players(query: ListQuery): Promise<PageResult<PlayerSummary>>;
  orders(query: ListQuery): Promise<PageResult<OrderSummary>>;
  payments(query: ListQuery): Promise<PageResult<PaymentSummary>>;
  audit(query: ListQuery): Promise<PageResult<AuditEntry>>;
}
export class PendingAdminService implements PendingServices {
  private unavailable(query: ListQuery): never {
    if (!listQuerySchema.safeParse(query).success) throw new SiteError('INVALID_INPUT', 400);
    throw new SiteError('API_GAP');
  }
  async players(query: ListQuery): Promise<PageResult<PlayerSummary>> {
    return this.unavailable(query);
  }
  async orders(query: ListQuery): Promise<PageResult<OrderSummary>> {
    return this.unavailable(query);
  }
  async payments(query: ListQuery): Promise<PageResult<PaymentSummary>> {
    return this.unavailable(query);
  }
  async audit(query: ListQuery): Promise<PageResult<AuditEntry>> {
    return this.unavailable(query);
  }
}
