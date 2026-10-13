import { z } from 'zod';
// Espelha GET /internal/site/players/:id/activity. Segundos inteiros; datas locais (America/Sao_Paulo).
const iso = z.iso.datetime();
export const activitySchema = z.object({
  playerId: z.uuid(),
  status: z.union([
    z.object({
      online: z.literal(true),
      since: iso,
      citizenId: z.string().max(11),
      cityId: z.number().int().nullable(),
      lastSeenAt: iso,
    }),
    z.object({ online: z.literal(false) }),
  ]),
  firstSeenAt: iso.nullable(),
  lastSeenAt: iso.nullable(),
  totals: z.object({
    today: z.number().int(),
    last7Days: z.number().int(),
    last30Days: z.number().int(),
    last90Days: z.number().int(),
    thisMonth: z.number().int(),
    allTime: z.number().int(),
    custom: z.number().int().nullable(),
  }),
  range: z.object({ from: z.string(), to: z.string() }).nullable(),
  byDay: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), seconds: z.number().int() })).max(400),
  byCharacter: z
    .array(z.object({ citizenId: z.string().max(11), cityId: z.number().int().nullable(), seconds: z.number().int() }))
    .max(100),
  sessions: z
    .array(
      z.object({
        id: z.uuid(),
        citizenId: z.string().max(11),
        cityId: z.number().int().nullable(),
        startedAt: iso,
        endedAt: iso.nullable(),
        durationSeconds: z.number().int(),
        endReason: z
          .enum(['quit', 'character_switch', 'server_stop', 'server_restart', 'timeout', 'invalidated', 'superseded'])
          .nullable(),
      }),
    )
    .max(100),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type Activity = z.infer<typeof activitySchema>;
