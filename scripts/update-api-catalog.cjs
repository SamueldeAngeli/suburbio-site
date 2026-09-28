const fs=require('node:fs'); const path=require('node:path'); const root='D:/api suburbio';
const write=(p,s)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),s);};
const edit=(p,a,b)=>{const f=path.join(root,p),s=fs.readFileSync(f,'utf8');if(!s.includes(a))throw Error(p);fs.writeFileSync(f,s.replace(a,b));};
write('src/database/migrations/005_product_catalog.ts',`import { sql, type Kysely } from "kysely";
export async function up(db: Kysely<unknown>) {
  await sql\`
    CREATE TABLE catalog_state (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), version bigint NOT NULL DEFAULT 0 CHECK(version>=0));
    INSERT INTO catalog_state(singleton) VALUES(true);
    CREATE TABLE product_categories (category_id uuid PRIMARY KEY, slug text UNIQUE NOT NULL, data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'), revision integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE catalog_products (product_id uuid PRIMARY KEY, category_id uuid NOT NULL REFERENCES product_categories(category_id), slug text UNIQUE NOT NULL, data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'), revision integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE INDEX catalog_products_category_idx ON catalog_products(category_id);
    CREATE INDEX catalog_products_order_idx ON catalog_products (((data->>'displayOrder')::integer), product_id);
  \`.execute(db);
}
// Institutional catalog: rollback deliberately refused after data exists.
export async function down(db: Kysely<unknown>) {
  await sql\`DO $$ BEGIN IF EXISTS(SELECT 1 FROM catalog_products) OR EXISTS(SELECT 1 FROM product_categories) THEN RAISE EXCEPTION 'Catalog contains institutional history'; END IF; END $$; DROP TABLE catalog_products; DROP TABLE product_categories; DROP TABLE catalog_state;\`.execute(db);
}
`);
write('src/database/postgres/catalog-types.ts',`import type { ColumnType, Generated } from "kysely";
type Json = ColumnType<Record<string, unknown>, string, string>;
interface CatalogEntry { slug: string; data: Json; revision: Generated<number>; created_at: Generated<Date>; updated_at: Generated<Date>; }
export interface CatalogDatabase {
  catalog_state: { singleton: boolean; version: Generated<string> };
  product_categories: CatalogEntry & { category_id: string };
  catalog_products: CatalogEntry & { product_id: string; category_id: string };
}
`);
write('src/contracts/catalog.ts',`import { z } from "zod";
export const status = z.enum(["active","inactive","archived"]);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100);
const name = z.string().trim().min(2).max(120);
export const categoryInput = z.object({name,slug,displayOrder:z.number().int().min(0).max(100000),status}).strict();
const resourceName=z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
export const delivery = z.discriminatedUnion("deliveryType",[
  z.object({deliveryType:z.literal("INVENTORY_ITEM"),deliveryPayload:z.object({itemName:resourceName,amount:z.number().int().min(1).max(10000)}).strict()}),
  z.object({deliveryType:z.literal("VEHICLE"),deliveryPayload:z.object({vehicleModel:resourceName}).strict()}),
  z.object({deliveryType:z.literal("VIP"),deliveryPayload:z.object({plan:resourceName,days:z.number().int().min(1).max(365)}).strict()}),
  z.object({deliveryType:z.literal("SERVICE"),deliveryPayload:z.object({service:resourceName}).strict()}),
  z.object({deliveryType:z.literal("CUSTOM"),deliveryPayload:z.object({adapter:resourceName}).strict()}),
]);
export const productInput=z.object({name,slug,description:z.string().trim().max(3000),categoryId:z.uuid(),imageUrl:z.union([z.literal(""),z.url().refine(v=>new URL(v).protocol==="https:")]),status,displayOrder:z.number().int().min(0).max(100000),salesChannels:z.array(z.enum(["SITE_VIP","INGAME_CRYPTO"])).min(1).max(2).refine(a=>new Set(a).size===a.length),priceCrypto:z.number().int().min(0).max(100000000),priceMinor:z.number().int().min(0).max(100000000),stockMode:z.enum(["UNLIMITED","LIMITED"]),stockQuantity:z.number().int().min(0).max(100000000),delivery}).strict();
export const categorySchema=categoryInput.extend({id:z.uuid(),revision:z.number().int(),createdAt:z.iso.datetime(),updatedAt:z.iso.datetime()});
export const productSchema=productInput.extend({id:z.uuid(),revision:z.number().int(),createdAt:z.iso.datetime(),updatedAt:z.iso.datetime()});
export const publicProductSchema=productSchema.omit({delivery:true});
export const catalogSchema=z.object({catalogVersion:z.string().regex(/^\\d+$/),products:z.array(publicProductSchema),categories:z.array(categorySchema)});
export type ProductInput=z.infer<typeof productInput>;
export type CategoryInput=z.infer<typeof categoryInput>;
`);
write('src/modules/catalog/service.ts',`import {randomUUID} from "node:crypto";
import {sql} from "kysely";
import type {Db,Tx} from "../../database/postgres/types.js";
import type {OperationContext} from "../operations/service.js";
import {requireAdminCapability} from "../admin/access.js";
import {adminAudit} from "../audit/admin.js";
import {enqueueEvent} from "../outbox/event.js";
import {ApiError} from "../../http/errors.js";
import {productSchema,categorySchema,publicProductSchema,type ProductInput,type CategoryInput} from "../../contracts/catalog.js";
export const productDto=(row:{product_id:string;data:Record<string,unknown>;revision:number;created_at:Date;updated_at:Date})=>productSchema.parse({...row.data,id:row.product_id,revision:row.revision,createdAt:row.created_at.toISOString(),updatedAt:row.updated_at.toISOString()});
export const categoryDto=(row:{category_id:string;data:Record<string,unknown>;revision:number;created_at:Date;updated_at:Date})=>categorySchema.parse({...row.data,id:row.category_id,revision:row.revision,createdAt:row.created_at.toISOString(),updatedAt:row.updated_at.toISOString()});
async function lockCatalog(tx:Tx){await tx.selectFrom("catalog_state").select("version").where("singleton","=",true).forUpdate().executeTakeFirstOrThrow();}
async function changed(tx:Tx,ctx:OperationContext,id:string){
  const state=await tx.updateTable("catalog_state").set({version:sql\`version+1\`}).where("singleton","=",true).returning("version").executeTakeFirstOrThrow();
  await enqueueEvent(tx,{type:"catalog.updated",aggregateType:"catalog",aggregateId:id,payload:{catalogVersion:state.version,operationId:ctx.operationId},consumers:["fivem-bridge"],scope:"INSTITUTIONAL"});
  return state.version;
}
export async function saveCategory(tx:Tx,ctx:OperationContext,actorDiscordId:string,input:CategoryInput,id?:string,expectedRevision?:number){
  const actor=await requireAdminCapability(tx,actorDiscordId,id?"PRODUCTS_UPDATE":"PRODUCTS_CREATE");
  if(input.status!=="active")await requireAdminCapability(tx,actorDiscordId,"PRODUCTS_DISABLE");
  await lockCatalog(tx);
  const before=id?await tx.selectFrom("product_categories").selectAll().where("category_id","=",id).executeTakeFirst():undefined;
  if(id&&!before)throw new ApiError("CATEGORY_NOT_FOUND",404,"Categoria não encontrada.");
  if(before&&before.revision!==expectedRevision)throw new ApiError("REVISION_CONFLICT",409,"Categoria alterada. Recarregue antes de salvar.");
  if(await tx.selectFrom("product_categories").select("category_id").where("slug","=",input.slug).where("category_id","!=",id??"00000000-0000-0000-0000-000000000000").executeTakeFirst())throw new ApiError("SLUG_CONFLICT",409,"Identificador já utilizado.");
  const categoryId=id??randomUUID();
  const row=before?await tx.updateTable("product_categories").set({slug:input.slug,data:JSON.stringify(input),revision:before.revision+1,updated_at:new Date()}).where("category_id","=",categoryId).returningAll().executeTakeFirstOrThrow():await tx.insertInto("product_categories").values({category_id:categoryId,slug:input.slug,data:JSON.stringify(input)}).returningAll().executeTakeFirstOrThrow();
  await adminAudit(tx,ctx,id?"category.updated":"category.created","category",categoryId,actor,null,{before:before?categoryDto(before):null,after:categoryDto(row)});
  return {value:{category:categoryDto(row),catalogVersion:await changed(tx,ctx,categoryId)}};
}
export async function saveProduct(tx:Tx,ctx:OperationContext,actorDiscordId:string,input:ProductInput,id?:string,expectedRevision?:number){
  const actor=await requireAdminCapability(tx,actorDiscordId,id?"PRODUCTS_UPDATE":"PRODUCTS_CREATE");
  if(input.status!=="active")await requireAdminCapability(tx,actorDiscordId,"PRODUCTS_DISABLE");
  await lockCatalog(tx);
  const category=await tx.selectFrom("product_categories").selectAll().where("category_id","=",input.categoryId).executeTakeFirst();
  if(!category||category.data.status!=="active")throw new ApiError("CATEGORY_NOT_ACTIVE",409,"Categoria indisponível.");
  const before=id?await tx.selectFrom("catalog_products").selectAll().where("product_id","=",id).executeTakeFirst():undefined;
  if(id&&!before)throw new ApiError("PRODUCT_NOT_FOUND",404,"Produto não encontrado.");
  if(before&&before.revision!==expectedRevision)throw new ApiError("REVISION_CONFLICT",409,"Produto alterado. Recarregue antes de salvar.");
  if(await tx.selectFrom("catalog_products").select("product_id").where("slug","=",input.slug).where("product_id","!=",id??"00000000-0000-0000-0000-000000000000").executeTakeFirst())throw new ApiError("SLUG_CONFLICT",409,"Identificador já utilizado.");
  const productId=id??randomUUID();
  const row=before?await tx.updateTable("catalog_products").set({slug:input.slug,category_id:input.categoryId,data:JSON.stringify(input),revision:before.revision+1,updated_at:new Date()}).where("product_id","=",productId).returningAll().executeTakeFirstOrThrow():await tx.insertInto("catalog_products").values({product_id:productId,slug:input.slug,category_id:input.categoryId,data:JSON.stringify(input)}).returningAll().executeTakeFirstOrThrow();
  const action=id?(input.status==="active"?"product.updated":"product.disabled"):"product.created";
  await adminAudit(tx,ctx,action,"product",productId,actor,null,{before:before?productDto(before):null,after:productDto(row)});
  const version=await changed(tx,ctx,productId);
  await enqueueEvent(tx,{type:action,aggregateType:"product",aggregateId:productId,payload:{productId,catalogVersion:version,operationId:ctx.operationId},consumers:["fivem-bridge"],scope:"INSTITUTIONAL"});
  return {value:{product:productDto(row),catalogVersion:version}};
}
export async function publicCatalog(db:Db,channel:"SITE_VIP"|"INGAME_CRYPTO"){
  return db.transaction().setIsolationLevel("repeatable read").execute(async tx=>{
    const state=await tx.selectFrom("catalog_state").select("version").where("singleton","=",true).executeTakeFirstOrThrow();
    const categories=(await tx.selectFrom("product_categories").selectAll().where(sql<string>\`data->>'status'\`,"=","active").execute()).map(categoryDto).sort((a,b)=>a.displayOrder-b.displayOrder||a.id.localeCompare(b.id));
    const categoryIds=new Set(categories.map(c=>c.id));
    const products=(await tx.selectFrom("catalog_products").selectAll().where(sql<string>\`data->>'status'\`,"=","active").where(sql<boolean>\`data->'salesChannels' ? \${channel}\`).execute()).map(productDto).filter(p=>categoryIds.has(p.categoryId)).map(p=>publicProductSchema.parse(p)).sort((a,b)=>a.displayOrder-b.displayOrder||a.id.localeCompare(b.id));
    return {catalogVersion:state.version,products,categories};
  });
}
`);
write('src/http/catalog.ts',`import type {FastifyInstance} from "fastify";
import type {ZodTypeProvider} from "fastify-type-provider-zod";
import {z} from "zod";
import type {Db} from "../database/postgres/types.js";
import type {Config} from "../config/env.js";
import {discordId} from "../contracts/admin.js";
import {productInput,categoryInput} from "../contracts/catalog.js";
import {idempotencyHeaders} from "../contracts/allowlist.js";
import {requireAdminCapability} from "../modules/admin/access.js";
import {publicCatalog,saveProduct,saveCategory,productDto,categoryDto} from "../modules/catalog/service.js";
import {mutate} from "./operations.js";
import {ApiError} from "./errors.js";
export function registerCatalog(instance:FastifyInstance,db:Db,config:Config){
  const app=instance.withTypeProvider<ZodTypeProvider>();
  app.get("/internal/fivem/catalog",async()=>publicCatalog(db,"INGAME_CRYPTO"));
  app.get("/internal/site/catalog",async()=>publicCatalog(db,"SITE_VIP"));
  app.get("/internal/fivem/catalog/version",async()=>({catalogVersion:(await db.selectFrom("catalog_state").select("version").where("singleton","=",true).executeTakeFirstOrThrow()).version}));
  const actor=z.object({actorDiscordId:discordId}).strict();
  const listing=actor.extend({page:z.coerce.number().int().min(1).max(100000).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(25),q:z.string().trim().max(100).default("")});
  app.get("/internal/site/products",{schema:{querystring:listing}},async req=>db.transaction().setIsolationLevel("repeatable read").execute(async tx=>{
    await requireAdminCapability(tx,req.query.actorDiscordId,"PRODUCTS_READ");
    let query=tx.selectFrom("catalog_products");
    if(req.query.q)query=query.where("slug","like","%"+req.query.q.replaceAll("%","\\%").replaceAll("_","\\_")+"%");
    const count=await query.select(eb=>eb.fn.countAll<string>().as("total")).executeTakeFirstOrThrow();
    const items=(await query.selectAll().orderBy("created_at","desc").orderBy("product_id").offset((req.query.page-1)*req.query.pageSize).limit(req.query.pageSize).execute()).map(productDto);
    return {items,total:Number(count.total),page:req.query.page,pageSize:req.query.pageSize};
  }));
  app.get("/internal/site/products/:id",{schema:{querystring:actor,params:z.object({id:z.uuid()})}},async req=>db.transaction().execute(async tx=>{
    await requireAdminCapability(tx,req.query.actorDiscordId,"PRODUCTS_READ");
    const row=await tx.selectFrom("catalog_products").selectAll().where("product_id","=",req.params.id).executeTakeFirst();
    if(!row)throw new ApiError("PRODUCT_NOT_FOUND",404,"Produto não encontrado.");return productDto(row);
  }));
  app.get("/internal/site/categories",{schema:{querystring:actor}},async req=>db.transaction().execute(async tx=>{await requireAdminCapability(tx,req.query.actorDiscordId,"PRODUCTS_READ");return {items:(await tx.selectFrom("product_categories").selectAll().orderBy("slug").execute()).map(categoryDto)};}));
  app.post("/internal/site/products",{schema:{headers:idempotencyHeaders,body:actor.extend({product:productInput})}},async req=>mutate(req,db,config,"product.create",req.body,(tx,ctx)=>saveProduct(tx,ctx,req.body.actorDiscordId,req.body.product)));
  app.post("/internal/site/products/:id",{schema:{headers:idempotencyHeaders,params:z.object({id:z.uuid()}),body:actor.extend({product:productInput,expectedRevision:z.number().int().positive()})}},async req=>mutate(req,db,config,"product.update",{...req.body,id:req.params.id},(tx,ctx)=>saveProduct(tx,ctx,req.body.actorDiscordId,req.body.product,req.params.id,req.body.expectedRevision)));
  app.post("/internal/site/categories",{schema:{headers:idempotencyHeaders,body:actor.extend({category:categoryInput})}},async req=>mutate(req,db,config,"category.create",req.body,(tx,ctx)=>saveCategory(tx,ctx,req.body.actorDiscordId,req.body.category)));
  app.post("/internal/site/categories/:id",{schema:{headers:idempotencyHeaders,params:z.object({id:z.uuid()}),body:actor.extend({category:categoryInput,expectedRevision:z.number().int().positive()})}},async req=>mutate(req,db,config,"category.update",{...req.body,id:req.params.id},(tx,ctx)=>saveCategory(tx,ctx,req.body.actorDiscordId,req.body.category,req.params.id,req.body.expectedRevision)));
}
`);
edit('src/database/postgres/types.ts','import type { InstitutionalDatabase }','import type { CatalogDatabase } from "./catalog-types.js";\nimport type { InstitutionalDatabase }');
edit('src/database/postgres/types.ts','extends InstitutionalDatabase','extends InstitutionalDatabase, CatalogDatabase');
edit('src/database/migrations/index.ts','export const migrator','import * as catalog from "./005_product_catalog.js";\nexport const migrator');
edit('src/database/migrations/index.ts','"004_commerce_foundation": commerce,','"004_commerce_foundation": commerce,\n        "005_product_catalog": catalog,');
edit('src/bootstrap.ts','import { registerAdmin }','import { registerCatalog } from "./http/catalog.js";\nimport { registerAdmin }');
edit('src/bootstrap.ts','registerAdmin(app, deps.db, config);','registerAdmin(app, deps.db, config);\n  registerCatalog(app, deps.db, config);');
edit('src/http/operations.ts','if (type === "allowlist.revoke")','if (type === "allowlist.revoke" || type.startsWith("product.") || type.startsWith("category."))');
edit('src/bootstrap.ts','response: responseSchemas(route.url),','response: route.schema?.response ?? responseSchemas(route.url),');
edit('src/contracts/responses.ts','import { adminResolution,','import { productSchema, categorySchema, catalogSchema } from "./catalog.js";\nimport { adminResolution,');
edit('src/contracts/responses.ts','const responses: Record<string, z.ZodType> = {',`const responses: Record<string, z.ZodType> = {
  "/internal/fivem/catalog": catalogSchema,
  "/internal/site/catalog": catalogSchema,
  "/internal/fivem/catalog/version": z.object({catalogVersion:z.string()}),
`);
// GET/POST share paths: supply success schemas per method in onRoute.
edit('src/bootstrap.ts','response: route.schema?.response ?? responseSchemas(route.url),','response: route.schema?.response ?? responseSchemas(route.url, String(route.method)),');
edit('src/contracts/responses.ts','export function responseSchemas(path: string) {\n  const success = responses[path];',`export function responseSchemas(path: string, method = "GET") {
  const productMutation=z.object({product:productSchema,catalogVersion:z.string(),operationId:uuid});
  const categoryMutation=z.object({category:categorySchema,catalogVersion:z.string(),operationId:uuid});
  const success = path === "/internal/site/products" ? (method === "POST" ? productMutation : z.object({items:z.array(productSchema),total:z.number(),page:z.number(),pageSize:z.number()}))
    : path === "/internal/site/products/:id" ? (method === "POST" ? productMutation : productSchema)
    : path === "/internal/site/categories" ? (method === "POST" ? categoryMutation : z.object({items:z.array(categorySchema)}))
    : path === "/internal/site/categories/:id" ? categoryMutation : responses[path];`);
edit('tests/integration/resilience.test.ts','        4,','        5,');
console.log('Catalog sources and migration 005 installed. No production migration applied.');
