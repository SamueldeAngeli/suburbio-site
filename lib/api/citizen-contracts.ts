import { z } from 'zod';
export const balanceSchema = z.object({
  balance: z.string().regex(/^\d+$/),
  currency: z.literal('CRYPTO'),
  asOf: z.iso.datetime(),
});
export const charactersSchema = z.object({
  source: z.literal('REGISTERED'),
  items: z.array(
    z.object({ citizenId: z.string(), firstName: z.string().nullable(), lastName: z.string().nullable() }),
  ),
});
export function formatCrypto(value: string) {
  if (!/^\d+$/.test(value)) throw new Error('Invalid integer balance');
  return BigInt(value).toLocaleString('pt-BR');
}
