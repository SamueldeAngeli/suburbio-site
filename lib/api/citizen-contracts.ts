import { z } from 'zod';
export const balanceSchema = z.object({
  balance: z.string().regex(/^\d+$/),
  currency: z.literal('CRYPTO'),
  asOf: z.iso.datetime(),
});
// Espelha GET /internal/site/me/characters (fonte QBCore via API). null = indisponível, nunca 0/vazio inventado.
const label = z.string().max(60);
const grade = { grade: label.nullable(), gradeLevel: z.number().nullable() };
export const characterSchema = z.object({
  citizenId: z.string().max(11),
  slot: z.number().int().nullable(),
  firstName: label.nullable(),
  lastName: label.nullable(),
  // ry-phone (ry_phone_user_data 'ry-phone:number'); null = ausente, inválido ou ambíguo.
  phone: z.string().max(20).nullable(),
  job: z.object({ name: label, label, ...grade, onDuty: z.boolean().nullable() }).nullable(),
  gang: z.object({ name: label, label, ...grade }).nullable(),
  money: z.object({ cash: z.number(), bank: z.number() }).nullable(),
  vehicles: z
    .array(
      z.object({
        plate: z.string().max(8),
        model: z.string().max(50).nullable(),
        state: z.enum(['OUT', 'GARAGED', 'IMPOUNDED', 'UNKNOWN']),
      }),
    )
    .max(100)
    .nullable(),
  properties: z
    .array(z.object({ type: z.enum(['HOUSE', 'APARTMENT']), name: z.string().max(255) }))
    .max(200)
    .nullable(),
});
export const charactersSchema = z.object({
  source: z.literal('QBCORE'),
  // Limite configurado no qb-multicharacter (Config.DefaultNumberOfCharacters), não concessão individual.
  configuredCharacterSlots: z.number().int().min(1).max(50),
  items: z.array(characterSchema).max(100),
});
export type Character = z.infer<typeof characterSchema>;
export function formatCrypto(value: string) {
  if (!/^\d+$/.test(value)) throw new Error('Invalid integer balance');
  return BigInt(value).toLocaleString('pt-BR');
}
