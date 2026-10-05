import { z } from 'zod';
export const orderSummarySchema = z.object({
  id: z.uuid(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']),
  paymentStatus: z.enum(['pending', 'approved', 'rejected', 'cancelled', 'expired', 'review']).optional(),
  deliveryStatus: z.enum(['pending', 'delivered']).optional(),
  reservationStatus: z.enum(['none', 'reserved', 'consumed', 'released']),
  grossAmountMinor: z.string().regex(/^\d+$/),
  discountAmountMinor: z.string().regex(/^\d+$/),
  netAmountMinor: z.string().regex(/^\d+$/),
  currency: z.string(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime().nullable(),
});
export const orderDetailSchema = orderSummarySchema.extend({
  payments: z
    .array(
      z.object({
        id: z.uuid(),
        status: z.string(),
        amountMinor: z.string(),
        currency: z.string(),
        paidAt: z.iso.datetime().nullable(),
      }),
    )
    .optional(),
  deliveries: z
    .array(
      z.object({
        id: z.uuid(),
        orderItemId: z.uuid(),
        product: z.string(),
        status: z.enum(['PENDING', 'DELIVERED']),
        attempts: z.number().int(),
        lastError: z.string().nullable(),
        deliveredAt: z.iso.datetime().nullable(),
      }),
    )
    .optional(),
  notifications: z
    .array(
      z.object({ kind: z.string(), status: z.string(), attempts: z.number().int(), lastError: z.string().nullable() }),
    )
    .optional(),
  items: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      validityModeSnapshot: z.enum(['PERMANENT', 'DURATION']),
      durationDaysSnapshot: z.number().int().nullable(),
      renewableSnapshot: z.boolean(),
      quantity: z.number().int(),
      unitAmountMinor: z.string(),
      amountMinor: z.string(),
    }),
  ),
});
export const orderListSchema = z.object({
  items: z.array(orderSummarySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export const orderStatusLabel = {
  pending: 'Aguardando pagamento',
  confirmed: 'Pagamento confirmado',
  cancelled: 'Cancelado',
  completed: 'Concluído',
};
