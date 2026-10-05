import { z } from 'zod';
const discordId = z.string().regex(/^\d{17,20}$/);
export const giftInput = z
  .object({ recipientToken: z.string().min(20).max(2048), confirmed: z.literal(true), anonymousGift: z.boolean() })
  .strict();
export const recipientInput = z.object({ customerDiscordId: discordId, recipientDiscordId: discordId }).strict();
export const recipientSchema = z.object({
  recipientToken: z.string(),
  displayName: z.string(),
  discordId,
  expiresAt: z.iso.datetime(),
});
export const giftHistorySchema = z.object({
  items: z.array(
    z.object({
      id: z.uuid(),
      createdAt: z.iso.datetime(),
      status: z.string(),
      entitlements: z.array(
        z.object({
          id: z.uuid(),
          status: z.string(),
          startsAt: z.iso.datetime().nullable(),
          expiresAt: z.iso.datetime().nullable(),
        }),
      ),
      paymentStatus: z.string(),
      anonymousGift: z.boolean(),
      recipient: z.object({ displayName: z.string(), discordId }),
      sender: z.object({ discordId }).nullable(),
      products: z.array(
        z.object({
          name: z.string(),
          quantity: z.number().int(),
          validityMode: z.string(),
          durationDays: z.number().nullable(),
        }),
      ),
    }),
  ),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
});
