const fs=require('node:fs'),path=require('node:path'),root='D:/api suburbio';
const write=(p,s)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),s);};
const edit=(p,a,b)=>{const f=path.join(root,p),s=fs.readFileSync(f,'utf8');if(!s.includes(a))throw Error(p);fs.writeFileSync(f,s.replace(a,b));};
write('src/contracts/cart.ts',`import {z} from "zod";
export const cryptoInput=z.object({mode:z.enum(["package","custom"]),quantity:z.number().int().positive().max(1000000)}).strict();
export const cartInput=z.object({items:z.array(z.discriminatedUnion("kind",[
  z.object({kind:z.literal("product"),productId:z.uuid(),quantity:z.number().int().min(1).max(10)}).strict(),
  cryptoInput.extend({kind:z.literal("crypto")}),
])).min(1).max(50),couponCode:z.string().trim().max(64).optional()}).strict();
export const cryptoQuoteSchema=z.object({mode:z.enum(["package","custom"]),quantity:z.number().int(),unitPriceMinor:z.number().int(),totalPriceMinor:z.number().int(),currency:z.literal("BRL")});
export const cryptoConfigSchema=z.object({minimum:z.number().int(),maximum:z.number().int(),customUnitPriceMinor:z.number().int(),packages:z.array(cryptoQuoteSchema)});
export const cartQuoteSchema=z.object({catalogVersion:z.string(),items:z.array(z.object({key:z.string(),name:z.string(),kind:z.enum(["product","crypto"]),quantity:z.number().int(),unitPriceMinor:z.number().int(),totalPriceMinor:z.number().int(),deliveryQuantity:z.number().int()})),grossAmountMinor:z.number().int(),discountAmountMinor:z.number().int(),netAmountMinor:z.number().int(),currency:z.literal("BRL"),checkoutAvailable:z.literal(false)});
`);
write('src/modules/commerce/crypto.ts',`import {ApiError} from "../../http/errors.js";
import {cryptoInput} from "../../contracts/cart.js";
export const CRYPTO_PACKAGES=[50,100,150,200,300,400,500,700,1000] as const;
export function quoteCrypto(input:unknown,limits:{minimum:number;maximum:number}){
  const parsed=cryptoInput.safeParse(input);
  if(!parsed.success)throw new ApiError("CRYPTO_QUANTITY_INVALID",400,"Quantidade de Crypto inválida.");
  const {mode,quantity}=parsed.data;
  if(mode==="package"&&!CRYPTO_PACKAGES.some(n=>n===quantity))throw new ApiError("CRYPTO_PACKAGE_INVALID",400,"Pacote de Crypto inválido.");
  if(mode==="custom"&&(quantity<limits.minimum||quantity>limits.maximum))throw new ApiError("CRYPTO_QUANTITY_INVALID",400,"Quantidade fora dos limites permitidos.");
  const unitPriceMinor=mode==="package"?120:125;
  return {mode,quantity,unitPriceMinor,totalPriceMinor:quantity*unitPriceMinor,currency:"BRL" as const};
}
export function cryptoConfig(limits:{minimum:number;maximum:number}){
  return {...limits,customUnitPriceMinor:125,packages:CRYPTO_PACKAGES.map(quantity=>quoteCrypto({mode:"package",quantity},limits))};
}
`);
write('src/modules/commerce/cart.ts',`import type {Db} from "../../database/postgres/types.js";
import {cartInput} from "../../contracts/cart.js";
import {ApiError} from "../../http/errors.js";
import {quoteCrypto} from "./crypto.js";
import {publicCatalog} from "../catalog/service.js";
export async function quoteCart(db:Db,input:unknown,limits:{minimum:number;maximum:number}){
  const parsed=cartInput.safeParse(input);if(!parsed.success)throw new ApiError("CART_INVALID",400,"Carrinho inválido.");
  if(parsed.data.couponCode)throw new ApiError("COUPON_UNAVAILABLE",409,"Cupons ainda não estão disponíveis.");
  const catalog=await publicCatalog(db,"SITE_VIP");
  const seen=new Set<string>();
  const items=parsed.data.items.map(item=>{
    if(item.kind==="crypto"){
      const quote=quoteCrypto({mode:item.mode,quantity:item.quantity},limits),key="crypto:"+item.mode+":"+item.quantity;
      if(seen.has(key))throw new ApiError("CART_DUPLICATE_ITEM",400,"Agrupe itens repetidos.");seen.add(key);
      return {key,name:quote.quantity+" Crypto",kind:"crypto" as const,quantity:quote.quantity,unitPriceMinor:quote.unitPriceMinor,totalPriceMinor:quote.totalPriceMinor,deliveryQuantity:quote.quantity};
    }
    if(seen.has(item.productId))throw new ApiError("CART_DUPLICATE_ITEM",400,"Agrupe itens repetidos.");seen.add(item.productId);
    const product=catalog.products.find(p=>p.id===item.productId);
    if(!product||product.priceMinor<=0)throw new ApiError("PRODUCT_UNAVAILABLE",409,"Benefício indisponível para compra.");
    if(product.stockMode==="LIMITED"&&product.stockQuantity<item.quantity)throw new ApiError("STOCK_UNAVAILABLE",409,"Quantidade indisponível em estoque.");
    return {key:item.productId,name:product.name,kind:"product" as const,quantity:item.quantity,unitPriceMinor:product.priceMinor,totalPriceMinor:product.priceMinor*item.quantity,deliveryQuantity:item.quantity};
  });
  const grossAmountMinor=items.reduce((sum,item)=>sum+item.totalPriceMinor,0);
  return {catalogVersion:catalog.catalogVersion,items,grossAmountMinor,discountAmountMinor:0,netAmountMinor:grossAmountMinor,currency:"BRL" as const,checkoutAvailable:false as const};
}
`);
write('src/http/commerce.ts',`import type {FastifyInstance} from "fastify";
import type {ZodTypeProvider} from "fastify-type-provider-zod";
import type {Db} from "../database/postgres/types.js";
import type {Config} from "../config/env.js";
import {cryptoInput,cartInput} from "../contracts/cart.js";
import {cryptoConfig,quoteCrypto} from "../modules/commerce/crypto.js";
import {quoteCart} from "../modules/commerce/cart.js";
export function registerCommerce(instance:FastifyInstance,db:Db,config:Config){
  const app=instance.withTypeProvider<ZodTypeProvider>(),limits={minimum:config.CRYPTO_CUSTOM_MIN,maximum:config.CRYPTO_CUSTOM_MAX};
  app.get("/internal/site/crypto",async()=>cryptoConfig(limits));
  app.post("/internal/site/crypto/quote",{schema:{body:cryptoInput}},async req=>quoteCrypto(req.body,limits));
  app.post("/internal/site/cart/quote",{schema:{body:cartInput}},async req=>quoteCart(db,req.body,limits));
}
`);
edit('src/config/env.ts','    API_READ_ONLY: bool("false"),','    API_READ_ONLY: bool("false"),\n    CRYPTO_CUSTOM_MIN: z.coerce.number().int().min(1).max(1000000).default(1),\n    CRYPTO_CUSTOM_MAX: z.coerce.number().int().min(1).max(1000000).default(100000),');
edit('src/config/env.ts','    const fail = (message: string) => ctx.addIssue({ code: "custom", message });','    const fail = (message: string) => ctx.addIssue({ code: "custom", message });\n    if(v.CRYPTO_CUSTOM_MIN>v.CRYPTO_CUSTOM_MAX)fail("CRYPTO_CUSTOM_MIN não pode exceder CRYPTO_CUSTOM_MAX");');
edit('src/bootstrap.ts','import { registerCatalog }','import { registerCommerce } from "./http/commerce.js";\nimport { registerCatalog }');
edit('src/bootstrap.ts','  registerCatalog(app, deps.db, config);','  registerCatalog(app, deps.db, config);\n  registerCommerce(app, deps.db, config);');
edit('src/contracts/responses.ts','import { z } from "zod";','import { z } from "zod";\nimport {cryptoConfigSchema,cryptoQuoteSchema,cartQuoteSchema} from "./cart.js";');
edit('src/contracts/responses.ts','const responses: Record<string, z.ZodType> = {','const responses: Record<string, z.ZodType> = {\n  "/internal/site/crypto": cryptoConfigSchema,\n  "/internal/site/crypto/quote": cryptoQuoteSchema,\n  "/internal/site/cart/quote": cartQuoteSchema,');
edit('src/app.ts','req.url === "/internal/site/admin/resolve"','["/internal/site/admin/resolve", "/internal/site/crypto/quote", "/internal/site/cart/quote"].includes(req.url)');
fs.appendFileSync(path.join(root,'.env.example'),'\n# Quantidade personalizada; pacotes oficiais permanecem fixos.\nCRYPTO_CUSTOM_MIN=1\nCRYPTO_CUSTOM_MAX=100000\n');
write('tests/crypto.test.ts',`import {test} from "node:test";import assert from "node:assert/strict";
import {quoteCrypto,CRYPTO_PACKAGES} from "../src/modules/commerce/crypto.js";
const limits={minimum:1,maximum:100000};
for(const quantity of CRYPTO_PACKAGES)test("pacote "+quantity+" a 120 centavos",()=>assert.equal(quoteCrypto({mode:"package",quantity},limits).totalPriceMinor,quantity*120));
test("325 Crypto personalizados custam 40625 centavos",()=>assert.deepEqual(quoteCrypto({mode:"custom",quantity:325},limits),{mode:"custom",quantity:325,unitPriceMinor:125,totalPriceMinor:40625,currency:"BRL"}));
for(const quantity of [0,-1,1.2,NaN,Infinity,"50",100001])test("quantidade inválida "+String(quantity),()=>assert.throws(()=>quoteCrypto({mode:"custom",quantity},limits)));
test("limites configuráveis",()=>assert.throws(()=>quoteCrypto({mode:"custom",quantity:9},{minimum:10,maximum:500})));
test("pacote não oficial rejeitado",()=>assert.throws(()=>quoteCrypto({mode:"package",quantity:325},limits)));
test("preço do browser rejeitado",()=>assert.throws(()=>quoteCrypto({mode:"custom",quantity:325,totalPriceMinor:1},limits)));
`);
console.log('Crypto/cart quote implemented. No payment or production database mutation.');
