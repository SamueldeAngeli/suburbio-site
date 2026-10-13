import { z } from 'zod';
import { orderSummarySchema } from './order-contracts';
// Espelha as abas da ficha do jogador na API. RESTRICTED/UNAVAILABLE nunca viram zero na tela.
const iso = z.iso.datetime();
const missing = z.object({ available: z.literal(false), reason: z.enum(['RESTRICTED', 'UNAVAILABLE']) });
const section = <T extends z.ZodRawShape>(shape: T) =>
  z.union([z.object({ available: z.literal(true), ...shape }), missing]);
const named = z.object({ label: z.string().max(60), grade: z.string().max(60).nullable() });
export const discordIdentitySchema = z.object({
  discordId: z.string().regex(/^\d{17,20}$/),
  name: z.string().max(100).nullable(),
  displayName: z.string().max(100).nullable(),
  guildNickname: z.string().max(100).nullable(),
  username: z.string().max(100).nullable(),
  avatarHash: z.string().max(40).nullable(),
  observedAt: iso.nullable(),
});
export type DiscordIdentity = z.infer<typeof discordIdentitySchema>;

export const overviewSchema = z.object({
  playerId: z.uuid(),
  status: z.union([
    z.object({
      online: z.literal(true),
      since: iso,
      citizenId: z.string().max(11),
      cityId: z.number().int().nullable(),
      serverId: z.string().max(64),
      lastSeenAt: iso,
    }),
    z.object({ online: z.literal(false) }),
  ]),
  identity: z.object({
    characterName: z.string().max(121).nullable(),
    cityId: z.number().int().nullable(),
    citizenId: z.string().max(11).nullable(),
    discord: discordIdentitySchema.nullable(),
    steam: z.string().max(80).nullable(),
    fivem: z.string().max(80).nullable(),
    license: section({ value: z.string().max(80).nullable() }),
  }),
  firstSeenAt: iso.nullable(),
  lastSeenAt: iso.nullable(),
  summary: z.object({
    playtimeSeconds: z.number().int(),
    characters: section({ count: z.number().int() }),
    spent: section({ brlMinor: z.string(), crypto: z.string() }),
    cryptoBalance: section({ balance: z.string() }),
    punishments: section({ bans: z.number().int(), legacyBlocked: z.boolean().nullable() }),
    allowlist: z.enum(['active', 'revoked', 'none']),
  }),
});
export const charactersAdminSchema = z.object({
  playerId: z.uuid(),
  items: z
    .array(
      z.object({
        cityId: z.number().int(),
        citizenId: z.string().max(11),
        name: z.string().max(121).nullable(),
        online: z.boolean(),
        lastAccessAt: iso.nullable(),
        lastUpdatedAt: iso,
        playtimeSeconds: z.number().int(),
        job: named.nullable(),
        gang: named.nullable(),
        money: z.object({ cash: z.number(), bank: z.number() }).nullable(),
        createdAt: iso.nullable(),
      }),
    )
    .max(100),
});
export const purchasesSchema = z.object({
  items: z.array(
    orderSummarySchema.extend({
      salesChannel: z.enum(['WEB', 'INGAME']),
      products: z.array(z.object({ name: z.string(), quantity: z.number().int() })),
      couponCode: z.string().nullable(),
    }),
  ),
  totals: z.object({ brlApprovedMinor: z.string(), cryptoApproved: z.string() }),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export const punishmentsSchema = z.object({
  playerId: z.uuid(),
  source: z.literal('qbcore-bans'),
  complete: z.boolean(),
  legacyBlocked: z.boolean().nullable(),
  items: z
    .array(
      z.object({
        id: z.string(),
        type: z.literal('BAN'),
        reason: z.string().nullable(),
        responsible: z.string(),
        createdAt: iso.nullable(),
        expireRaw: z.number().nullable(),
        status: z.literal('UNCONFIRMED'),
        origin: z.literal('qbcore'),
      }),
    )
    .max(100),
});
export const TIMELINE_TYPES = ['session', 'allowlist', 'admin', 'order', 'payment', 'crypto', 'entitlement'] as const;
export const timelineSchema = z.object({
  playerId: z.uuid(),
  items: z
    .array(
      z.object({
        id: z.string(),
        at: iso,
        type: z.enum(TIMELINE_TYPES),
        action: z.string().max(80),
        detail: z.record(z.string(), z.unknown()),
      }),
    )
    .max(100),
  restrictedTypes: z.array(z.enum(TIMELINE_TYPES)),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
