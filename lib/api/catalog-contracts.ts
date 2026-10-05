import { z } from 'zod';
export const status = z.enum(['active', 'inactive', 'archived']);
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(100);
const name = z.string().trim().min(2).max(120);
export const categoryInput = z
  .object({ name, slug, displayOrder: z.number().int().min(0).max(100000), status })
  .strict();
const resourceName = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
export const delivery = z.discriminatedUnion('deliveryType', [
  z.object({
    deliveryType: z.literal('INVENTORY_ITEM'),
    deliveryPayload: z.object({ itemName: resourceName, amount: z.number().int().min(1).max(10000) }).strict(),
  }),
  z.object({ deliveryType: z.literal('VEHICLE'), deliveryPayload: z.object({ vehicleModel: resourceName }).strict() }),
  z.object({ deliveryType: z.literal('VIP'), deliveryPayload: z.object({ plan: resourceName }).strict() }),
  z.object({ deliveryType: z.literal('PROPERTY'), deliveryPayload: z.object({ propertyCode: resourceName }).strict() }),
  z.object({ deliveryType: z.literal('SERVICE'), deliveryPayload: z.object({ service: resourceName }).strict() }),
  z.object({ deliveryType: z.literal('CHARACTER_SLOT'), deliveryPayload: z.object({ amount: z.literal(1) }).strict() }),
  z.object({ deliveryType: z.literal('CUSTOM'), deliveryPayload: z.object({ adapter: resourceName }).strict() }),
]);
const productBase = z
  .object({
    allowCustomGifts: z.boolean().optional(),
    name,
    slug,
    description: z.string().trim().max(3000),
    categoryId: z.uuid(),
    imageUrl: z.union([z.literal(''), z.url().refine((v) => new URL(v).protocol === 'https:')]),
    status,
    displayOrder: z.number().int().min(0).max(100000),
    storefronts: z
      .array(z.enum(['VIP_STORE', 'VIP_DEALERSHIP', 'VIP_REAL_ESTATE', 'CRYPTO_STORE']))
      .max(4)
      .refine((a) => new Set(a).size === a.length)
      .optional(),
    salesChannels: z
      .array(z.enum(['SITE_VIP', 'INGAME_CRYPTO', 'WEB', 'INGAME']))
      .min(1)
      .max(2)
      .refine(
        (a) =>
          new Set(a.map((v) => (v === 'WEB' ? 'SITE_VIP' : v === 'INGAME' ? 'INGAME_CRYPTO' : v))).size === a.length,
      ),
    priceCrypto: z.number().int().min(0).max(100000000),
    priceMinor: z.number().int().min(0).max(100000000),
    stockMode: z.enum(['UNLIMITED', 'LIMITED']),
    stockQuantity: z.number().int().min(0).max(100000000),
    validityMode: z.enum(['PERMANENT', 'DURATION']),
    durationDays: z.number().int().min(1).max(3650).nullable().default(null),
    renewable: z.boolean().default(false),
    delivery,
  })
  .strict();
const validDuration = (v: { validityMode: string; durationDays: number | null; renewable: boolean }) =>
  v.validityMode === 'DURATION' ? v.durationDays !== null : v.durationDays === null && !v.renewable;
export const productInput = productBase.refine(validDuration, {
  message: 'Configure a duração de 1 a 3650 dias somente para benefícios temporários',
  path: ['durationDays'],
});
export const categorySchema = categoryInput.extend({
  id: z.uuid(),
  revision: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const productSchema = productBase.extend({
  id: z.uuid(),
  revision: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const publicProductSchema = productSchema.omit({ delivery: true }).refine(validDuration);
export const catalogSchema = z.object({
  catalogVersion: z.string().regex(/^\d+$/),
  products: z.array(publicProductSchema),
  categories: z.array(categorySchema),
});
export type ProductInput = z.infer<typeof productInput>;
export type CategoryInput = z.infer<typeof categoryInput>;
