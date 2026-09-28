import {z} from "zod";
import {couponSnapshotSchema} from "./coupon-contracts";
export const cryptoInput=z.object({mode:z.enum(["package","custom"]),quantity:z.number().int().positive().max(1000000)}).strict();
export const cartInput=z.object({items:z.array(z.discriminatedUnion("kind",[
  z.object({kind:z.literal("product"),productId:z.uuid(),quantity:z.number().int().min(1).max(10)}).strict(),
  cryptoInput.extend({kind:z.literal("crypto"),units:z.number().int().min(1).max(10).default(1)}),
])).min(1).max(50),couponCode:z.string().trim().max(64).optional()}).strict();
export const cryptoQuoteSchema=z.object({mode:z.enum(["package","custom"]),quantity:z.number().int(),unitPriceMinor:z.number().int(),totalPriceMinor:z.number().int(),currency:z.literal("BRL")});
export const cryptoConfigSchema=z.object({minimum:z.number().int(),maximum:z.number().int(),customUnitPriceMinor:z.number().int(),packages:z.array(cryptoQuoteSchema)});
export const cartQuoteSchema=z.object({coupon:couponSnapshotSchema.nullable(),catalogVersion:z.string(),items:z.array(z.object({key:z.string(),name:z.string(),kind:z.enum(["product","crypto"]),quantity:z.number().int(),unitPriceMinor:z.number().int(),totalPriceMinor:z.number().int(),deliveryQuantity:z.number().int()})),grossAmountMinor:z.number().int(),discountAmountMinor:z.number().int(),netAmountMinor:z.number().int(),currency:z.literal("BRL"),checkoutAvailable:z.literal(false)});
