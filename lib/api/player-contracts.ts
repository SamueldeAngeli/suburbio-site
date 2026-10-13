import { z } from 'zod';
// Espelha GET /internal/site/players. cityId = players.id (ID da cidade); citizenId = chave técnica do
// QBCore; playerId = UUID interno da API (nunca o identificador principal na interface).
const named = z.object({ label: z.string().max(60), grade: z.string().max(60).nullable() });
export const playerListSchema = z.object({
  items: z
    .array(
      z.object({
        cityId: z.number().int(),
        citizenId: z.string().max(11),
        name: z.string().max(121).nullable(),
        accountName: z.string().max(100),
        playerId: z.uuid().nullable(),
        discordId: z
          .string()
          .regex(/^\d{17,20}$/)
          .nullable(),
        discordVerified: z.boolean().nullable(),
        job: named.nullable(),
        gang: named.nullable(),
        money: z.object({ cash: z.number(), bank: z.number() }).nullable(),
        online: z.boolean().nullable(),
        allowlist: z.enum(['active', 'revoked', 'none']).nullable(),
        vip: z.boolean().nullable(),
        lastActivity: z.iso.datetime(),
      }),
    )
    .max(50),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type PlayerList = z.infer<typeof playerListSchema>;
