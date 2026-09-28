const fs=require('node:fs'),path=require('node:path'),root='D:/api suburbio';
const write=(p,s)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),s);};
const edit=(p,a,b)=>{const f=path.join(root,p),s=fs.readFileSync(f,'utf8');if(!s.includes(a))throw Error(p);fs.writeFileSync(f,s.replace(a,b));};
write('src/database/migrations/006_coupons.ts',`import {sql,type Kysely} from "kysely";
export async function up(db:Kysely<unknown>){await sql\`
CREATE TABLE coupons(coupon_id uuid PRIMARY KEY,code text UNIQUE NOT NULL,data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),revision integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE coupon_redemptions(redemption_id uuid PRIMARY KEY,coupon_id uuid NOT NULL REFERENCES coupons(coupon_id),order_id uuid UNIQUE NOT NULL REFERENCES orders(order_id),customer_discord_id text NOT NULL,status text NOT NULL CHECK(status IN ('reserved','applied','released')),snapshot jsonb NOT NULL,gross_amount_minor bigint NOT NULL CHECK(gross_amount_minor>=0),discount_amount_minor bigint NOT NULL CHECK(discount_amount_minor>=0 AND discount_amount_minor<=gross_amount_minor),net_amount_minor bigint NOT NULL CHECK(net_amount_minor=gross_amount_minor-discount_amount_minor),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX coupon_redemptions_usage_idx ON coupon_redemptions(coupon_id,status,customer_discord_id);
\`.execute(db);}
export async function down(db:Kysely<unknown>){await sql\`DO $$ BEGIN IF EXISTS(SELECT 1 FROM coupons) OR EXISTS(SELECT 1 FROM coupon_redemptions) THEN RAISE EXCEPTION 'Coupon history must be preserved'; END IF; END $$; DROP TABLE coupon_redemptions; DROP TABLE coupons;\`.execute(db);}
`);
write('src/database/postgres/coupon-types.ts',`import type {ColumnType,Generated} from "kysely";
type Json=ColumnType<Record<string,unknown>,string,string>;type Money=ColumnType<string,string,string>;
export interface CouponDatabase{
coupons:{coupon_id:string;code:string;data:Json;revision:Generated<number>;created_at:Generated<Date>;updated_at:Generated<Date>};
coupon_redemptions:{redemption_id:string;coupon_id:string;order_id:string;customer_discord_id:string;status:"reserved"|"applied"|"released";snapshot:Json;gross_amount_minor:Money;discount_amount_minor:Money;net_amount_minor:Money;created_at:Generated<Date>;updated_at:Generated<Date>};
}
`);
write('src/contracts/coupons.ts',`import {z} from "zod";
export const couponInput=z.object({code:z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,32}$/),discountType:z.enum(["percentage","fixed"]),discountValue:z.number().int().positive().max(100000000),minimumAmountMinor:z.number().int().min(0).max(100000000),startsAt:z.iso.datetime().nullable(),expiresAt:z.iso.datetime().nullable(),maxUses:z.number().int().positive().nullable(),maxUsesPerUser:z.number().int().positive().nullable(),scope:z.enum(["ALL","VIP","CRYPTO","PRODUCT","CATEGORY"]),productIds:z.array(z.uuid()).max(100),categoryIds:z.array(z.uuid()).max(100),firstPurchaseOnly:z.boolean(),status:z.enum(["active","inactive","archived"])}).strict().refine(c=>c.discountType!=="percentage"||c.discountValue<=100,{message:"Percentual deve ser no máximo 100"}).refine(c=>!c.startsAt||!c.expiresAt||c.startsAt<c.expiresAt,{message:"Período inválido"}).refine(c=>c.scope!=="PRODUCT"||c.productIds.length>0,{message:"Selecione produtos"}).refine(c=>c.scope!=="CATEGORY"||c.categoryIds.length>0,{message:"Selecione categorias"});
export const couponSchema=couponInput.safeExtend({id:z.uuid(),revision:z.number().int(),createdAt:z.iso.datetime(),updatedAt:z.iso.datetime()});
export const couponSnapshotSchema=z.object({couponId:z.uuid(),couponCodeSnapshot:z.string(),discountTypeSnapshot:z.enum(["percentage","fixed"]),discountValueSnapshot:z.number().int(),grossAmountMinor:z.number().int(),discountAmountMinor:z.number().int(),netAmountMinor:z.number().int()});
export const couponMetricsSchema=z.object({usesCount:z.number().int(),grossSalesMinor:z.string(),discountGrantedMinor:z.string(),netSalesMinor:z.string()});
export type CouponInput=z.infer<typeof couponInput>;
`);
write('src/modules/commerce/coupons.ts',`import {randomUUID} from "node:crypto";
import {sql} from "kysely";
import type {Db,Tx} from "../../database/postgres/types.js";
import type {OperationContext} from "../operations/service.js";
import {ApiError} from "../../http/errors.js";
import {requireAdminCapability} from "../admin/access.js";
import {adminAudit} from "../audit/admin.js";
import {couponSchema,type CouponInput} from "../../contracts/coupons.js";
export const couponDto=(row:{coupon_id:string;data:Record<string,unknown>;revision:number;created_at:Date;updated_at:Date})=>couponSchema.parse({...row.data,id:row.coupon_id,revision:row.revision,createdAt:row.created_at.toISOString(),updatedAt:row.updated_at.toISOString()});
export async function saveCoupon(tx:Tx,ctx:OperationContext,actorDiscordId:string,input:CouponInput,id?:string,expectedRevision?:number){
  const actor=await requireAdminCapability(tx,actorDiscordId,id?"COUPONS_UPDATE":"COUPONS_CREATE");
  if(input.status!=="active")await requireAdminCapability(tx,actorDiscordId,"COUPONS_DISABLE");
  // Serializes create/update by code, so duplicate codes return a stable domain error.
  await sql\`SELECT pg_advisory_xact_lock(hashtextextended(\${"coupon:"+input.code},0))\`.execute(tx);
  const before=id?await tx.selectFrom("coupons").selectAll().where("coupon_id","=",id).forUpdate().executeTakeFirst():undefined;
  if(id&&!before)throw new ApiError("COUPON_NOT_FOUND",404,"Cupom não encontrado.");
  if(before&&before.revision!==expectedRevision)throw new ApiError("REVISION_CONFLICT",409,"Cupom alterado. Recarregue antes de salvar.");
  if(await tx.selectFrom("coupons").select("coupon_id").where("code","=",input.code).where("coupon_id","!=",id??"00000000-0000-0000-0000-000000000000").executeTakeFirst())throw new ApiError("COUPON_CODE_CONFLICT",409,"Código de cupom já utilizado.");
  const couponId=id??randomUUID();
  const row=before?await tx.updateTable("coupons").set({code:input.code,data:JSON.stringify(input),revision:before.revision+1,updated_at:new Date()}).where("coupon_id","=",couponId).returningAll().executeTakeFirstOrThrow():await tx.insertInto("coupons").values({coupon_id:couponId,code:input.code,data:JSON.stringify(input)}).returningAll().executeTakeFirstOrThrow();
  await adminAudit(tx,ctx,id?"coupon.updated":"coupon.created","coupon",couponId,actor,null,{before:before?couponDto(before):null,after:couponDto(row)});
  return {value:{coupon:couponDto(row)}};
}
export type DiscountLine={kind:"product"|"crypto";key:string;categoryId?:string;totalPriceMinor:number};
export function discountFor(coupon:CouponInput,lines:DiscountLine[],usage:{total:number;user:number;hasPurchase:boolean},now=new Date()){
  const gross=lines.reduce((sum,line)=>sum+line.totalPriceMinor,0);
  if(coupon.status!=="active"||(coupon.startsAt&&Date.parse(coupon.startsAt)>now.getTime())||(coupon.expiresAt&&Date.parse(coupon.expiresAt)<=now.getTime())||(coupon.maxUses!==null&&usage.total>=coupon.maxUses)||(coupon.maxUsesPerUser!==null&&usage.user>=coupon.maxUsesPerUser)||(coupon.firstPurchaseOnly&&usage.hasPurchase)||gross<coupon.minimumAmountMinor)throw new ApiError("COUPON_NOT_ELIGIBLE",409,"Cupom não disponível para este pedido.");
  const eligible=lines.filter(line=>coupon.scope==="ALL"||(coupon.scope==="VIP"&&line.kind==="product")||(coupon.scope==="CRYPTO"&&line.kind==="crypto")||(coupon.scope==="PRODUCT"&&coupon.productIds.includes(line.key))||(coupon.scope==="CATEGORY"&&!!line.categoryId&&coupon.categoryIds.includes(line.categoryId))).reduce((sum,line)=>sum+line.totalPriceMinor,0);
  if(!eligible)throw new ApiError("COUPON_NOT_ELIGIBLE",409,"Cupom não aplicável aos itens selecionados.");
  return Math.min(eligible,coupon.discountType==="percentage"?Math.floor(eligible*coupon.discountValue/100):coupon.discountValue);
}
export async function couponDiscount(db:Db|Tx,code:string,customerDiscordId:string,lines:DiscountLine[]){
  const row=await db.selectFrom("coupons").selectAll().where("code","=",code.trim().toUpperCase()).executeTakeFirst();
  if(!row)throw new ApiError("COUPON_NOT_ELIGIBLE",409,"Cupom não disponível para este pedido.");
  const coupon=couponDto(row),base=db.selectFrom("coupon_redemptions").where("coupon_id","=",coupon.id).where("status","in",["reserved","applied"]);
  const total=await base.select(eb=>eb.fn.countAll<string>().as("count")).executeTakeFirstOrThrow(),user=await base.where("customer_discord_id","=",customerDiscordId).select(eb=>eb.fn.countAll<string>().as("count")).executeTakeFirstOrThrow();
  const hasPurchase=!!(await db.selectFrom("orders").select("order_id").where("customer_discord_id","=",customerDiscordId).where("status","in",["confirmed","completed"]).executeTakeFirst());
  const discountAmountMinor=discountFor(coupon,lines,{total:Number(total.count),user:Number(user.count),hasPurchase});
  const grossAmountMinor=lines.reduce((sum,line)=>sum+line.totalPriceMinor,0);
  return {couponId:coupon.id,couponCodeSnapshot:coupon.code,discountTypeSnapshot:coupon.discountType,discountValueSnapshot:coupon.discountValue,grossAmountMinor,discountAmountMinor,netAmountMinor:grossAmountMinor-discountAmountMinor};
}
export async function couponMetrics(db:Db|Tx,id:string){
  const row=await db.selectFrom("coupon_redemptions").where("coupon_id","=",id).where("status","=","applied").select(eb=>[eb.fn.countAll<string>().as("uses"),sql<string>\`coalesce(sum(gross_amount_minor),0)::text\`.as("gross"),sql<string>\`coalesce(sum(discount_amount_minor),0)::text\`.as("discount"),sql<string>\`coalesce(sum(net_amount_minor),0)::text\`.as("net")]).executeTakeFirstOrThrow();
  return {usesCount:Number(row.uses),grossSalesMinor:row.gross,discountGrantedMinor:row.discount,netSalesMinor:row.net};
}
`);
write('src/http/coupons.ts',`import type {FastifyInstance} from "fastify";
import type {ZodTypeProvider} from "fastify-type-provider-zod";
import {z} from "zod";
import type {Db} from "../database/postgres/types.js";import type {Config} from "../config/env.js";
import {discordId} from "../contracts/admin.js";import {couponInput} from "../contracts/coupons.js";
import {idempotencyHeaders} from "../contracts/allowlist.js";
import {requireAdminCapability} from "../modules/admin/access.js";
import {couponDto,couponMetrics,saveCoupon} from "../modules/commerce/coupons.js";
import {mutate} from "./operations.js";import {ApiError} from "./errors.js";
export function registerCoupons(instance:FastifyInstance,db:Db,config:Config){
 const app=instance.withTypeProvider<ZodTypeProvider>(),actor=z.object({actorDiscordId:discordId}).strict();
 app.get("/internal/site/coupons",{schema:{querystring:actor.extend({page:z.coerce.number().int().min(1).max(100000).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(25)})}},async req=>db.transaction().setIsolationLevel("repeatable read").execute(async tx=>{
 await requireAdminCapability(tx,req.query.actorDiscordId,"COUPONS_READ");const total=await tx.selectFrom("coupons").select(eb=>eb.fn.countAll<string>().as("total")).executeTakeFirstOrThrow();
 const rows=await tx.selectFrom("coupons").selectAll().orderBy("created_at","desc").orderBy("coupon_id").limit(req.query.pageSize).offset((req.query.page-1)*req.query.pageSize).execute();
 const items=await Promise.all(rows.map(async row=>({...couponDto(row),metrics:await couponMetrics(tx,row.coupon_id)})));
 return {items,page:req.query.page,pageSize:req.query.pageSize,total:Number(total.total)};}));
 app.get("/internal/site/coupons/:id",{schema:{params:z.object({id:z.uuid()}),querystring:actor}},async req=>db.transaction().execute(async tx=>{await requireAdminCapability(tx,req.query.actorDiscordId,"COUPONS_READ");const row=await tx.selectFrom("coupons").selectAll().where("coupon_id","=",req.params.id).executeTakeFirst();if(!row)throw new ApiError("COUPON_NOT_FOUND",404,"Cupom não encontrado.");return {...couponDto(row),metrics:await couponMetrics(tx,row.coupon_id)};}));
 app.post("/internal/site/coupons",{schema:{headers:idempotencyHeaders,body:actor.extend({coupon:couponInput})}},async req=>mutate(req,db,config,"coupon.create",req.body,(tx,ctx)=>saveCoupon(tx,ctx,req.body.actorDiscordId,req.body.coupon)));
 app.post("/internal/site/coupons/:id",{schema:{headers:idempotencyHeaders,params:z.object({id:z.uuid()}),body:actor.extend({coupon:couponInput,expectedRevision:z.number().int().positive()})}},async req=>mutate(req,db,config,"coupon.update",{...req.body,id:req.params.id},(tx,ctx)=>saveCoupon(tx,ctx,req.body.actorDiscordId,req.body.coupon,req.params.id,req.body.expectedRevision)));
}
`);
edit('src/database/postgres/types.ts','import type { CatalogDatabase }','import type { CouponDatabase } from "./coupon-types.js";\nimport type { CatalogDatabase }');
edit('src/database/postgres/types.ts','extends InstitutionalDatabase, CatalogDatabase','extends InstitutionalDatabase, CatalogDatabase, CouponDatabase');
edit('src/database/migrations/index.ts','export const migrator','import * as coupons from "./006_coupons.js";\nexport const migrator');
edit('src/database/migrations/index.ts','"005_product_catalog": catalog,','"005_product_catalog": catalog,\n        "006_coupons": coupons,');
edit('src/bootstrap.ts','import { registerCommerce }','import { registerCoupons } from "./http/coupons.js";\nimport { registerCommerce }');
edit('src/bootstrap.ts','  registerCommerce(app, deps.db, config);','  registerCommerce(app, deps.db, config);\n  registerCoupons(app, deps.db, config);');
edit('src/http/operations.ts','type.startsWith("category.")','type.startsWith("category.") || type.startsWith("coupon.")');
edit('src/contracts/responses.ts','import { z } from "zod";','import { z } from "zod";\nimport {couponSchema,couponMetricsSchema} from "./coupons.js";');
edit('src/contracts/responses.ts','  const success = path ===','  const couponMutation=z.object({coupon:couponSchema,operationId:uuid});\n  const couponDetail=couponSchema.safeExtend({metrics:couponMetricsSchema});\n  const success = path === "/internal/site/coupons" ? (method === "POST" ? couponMutation : z.object({items:z.array(couponDetail),page:z.number(),pageSize:z.number(),total:z.number()}))\n    : path === "/internal/site/coupons/:id" ? (method === "POST" ? couponMutation : couponDetail)\n    : path ===');
const testFile=path.join(root,'tests/integration/resilience.test.ts');fs.writeFileSync(testFile,fs.readFileSync(testFile,'utf8').replace(/(getMigrations\(\)\)\.filter\(\(m\) => m.executedAt\)[\s\S]{0,30}\.length,\s*)5,/,'$16,'));
console.log('Coupons source/migration installed. Quote integration and order reservations still pending.');
