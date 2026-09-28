const fs=require('node:fs'),path=require('node:path');
const root='D:/api suburbio';
const write=(p,s)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),s)};
const edit=(p,a,b)=>{const f=path.join(root,p),s=fs.readFileSync(f,'utf8');if(!s.includes(a))throw Error(p+' anchor missing');fs.writeFileSync(f,s.replace(a,b))};
write('src/database/migrations/007_order_reservations.ts',`import {sql,type Kysely} from "kysely";
export async function up(db:Kysely<unknown>){await sql\`
ALTER TABLE orders ADD COLUMN gross_amount_minor bigint, ADD COLUMN discount_amount_minor bigint NOT NULL DEFAULT 0, ADD COLUMN coupon_snapshot jsonb, ADD COLUMN reservation_status text NOT NULL DEFAULT 'none' CHECK(reservation_status IN ('none','reserved','consumed','released')), ADD COLUMN expires_at timestamptz;
UPDATE orders SET gross_amount_minor=amount_minor;
ALTER TABLE orders ALTER COLUMN gross_amount_minor SET NOT NULL;
ALTER TABLE orders ADD CONSTRAINT order_amounts_valid CHECK(gross_amount_minor>=0 AND discount_amount_minor>=0 AND amount_minor=gross_amount_minor-discount_amount_minor);
ALTER TABLE order_items ADD COLUMN delivery_snapshot jsonb, ADD COLUMN stock_reserved boolean NOT NULL DEFAULT false;
CREATE INDEX orders_customer_created_idx ON orders(customer_discord_id,created_at DESC);
CREATE INDEX orders_expiry_idx ON orders(expires_at) WHERE reservation_status='reserved';
\`.execute(db);}
export async function down(db:Kysely<unknown>){await sql\`DO $$ BEGIN IF EXISTS(SELECT 1 FROM orders WHERE reservation_status<>'none') THEN RAISE EXCEPTION 'Order reservations must be preserved'; END IF; END $$; DROP INDEX orders_expiry_idx; DROP INDEX orders_customer_created_idx; ALTER TABLE order_items DROP COLUMN stock_reserved,DROP COLUMN delivery_snapshot; ALTER TABLE orders DROP CONSTRAINT order_amounts_valid,DROP COLUMN gross_amount_minor,DROP COLUMN discount_amount_minor,DROP COLUMN coupon_snapshot,DROP COLUMN reservation_status,DROP COLUMN expires_at;\`.execute(db);}
`);
edit('src/database/migrations/index.ts','export const migrator', 'import * as reservations from "./007_order_reservations.js";\nexport const migrator');
edit('src/database/migrations/index.ts','"006_coupons": coupons,','"006_coupons": coupons,\n        "007_order_reservations": reservations,');
// Defaults keep legacy writers explicit; migration supplies existing historical values.
edit('src/database/postgres/institutional-types.ts','interface Order extends ProviderRef {','interface Order extends ProviderRef {\n  gross_amount_minor: Money;\n  discount_amount_minor: Generated<Money>;\n  coupon_snapshot: Json | null;\n  reservation_status: Generated<"none" | "reserved" | "consumed" | "released">;\n  expires_at: Time | null;');
edit('src/database/postgres/institutional-types.ts','interface OrderItem {','interface OrderItem {\n  delivery_snapshot: Json | null;\n  stock_reserved: Generated<boolean>;');
write('src/contracts/orders.ts',`import {z} from "zod";
import {cartInput} from "./cart.js";
import {discordId} from "./admin.js";
export const createOrderInput=cartInput.extend({customerDiscordId:discordId,targetCharacterId:z.uuid().optional()});
export const orderSummarySchema=z.object({id:z.uuid(),status:z.enum(["pending","confirmed","cancelled","completed"]),reservationStatus:z.enum(["none","reserved","consumed","released"]),grossAmountMinor:z.string(),discountAmountMinor:z.string(),netAmountMinor:z.string(),currency:z.string(),createdAt:z.iso.datetime(),expiresAt:z.iso.datetime().nullable()});
export const orderDetailSchema=orderSummarySchema.extend({items:z.array(z.object({id:z.uuid(),name:z.string(),quantity:z.number().int(),unitAmountMinor:z.string(),amountMinor:z.string()}))});
`);
write('src/modules/commerce/orders.ts',`import {randomUUID} from "node:crypto";
import {sql} from "kysely";
import type {Selectable} from "kysely";
import type {Db,Tx,Database} from "../../database/postgres/types.js";
import type {OperationContext} from "../operations/service.js";
import {createOrderInput} from "../../contracts/orders.js";
import {ApiError} from "../../http/errors.js";
import {productDto} from "../catalog/service.js";
import {quoteCrypto} from "./crypto.js";
import {couponDiscount} from "./coupons.js";
import {adminAudit} from "../audit/admin.js";
import {enqueueEvent} from "../outbox/event.js";
export const orderSummary=(row:Selectable<Database["orders"]>)=>({id:row.order_id,status:row.status,reservationStatus:row.reservation_status,grossAmountMinor:row.gross_amount_minor,discountAmountMinor:row.discount_amount_minor,netAmountMinor:row.amount_minor,currency:row.currency,createdAt:row.created_at.toISOString(),expiresAt:row.expires_at?.toISOString()??null});
async function lock(tx:Tx,customer:string){
 await sql\`SELECT pg_advisory_xact_lock(hashtextextended(\${"commerce-customer:"+customer},0))\`.execute(tx);
 await tx.selectFrom("catalog_state").selectAll().where("singleton","=",true).forUpdate().executeTakeFirstOrThrow();
}
async function catalogChanged(tx:Tx,ctx:OperationContext,id:string){
 const state=await tx.updateTable("catalog_state").set({version:sql\`version+1\`}).where("singleton","=",true).returning("version").executeTakeFirstOrThrow();
 await enqueueEvent(tx,{type:"catalog.updated",aggregateType:"catalog",aggregateId:id,payload:{catalogVersion:state.version,operationId:ctx.operationId},consumers:["fivem-bridge"],scope:"INSTITUTIONAL"});
}
export async function createOrder(tx:Tx,ctx:OperationContext,input:unknown,limits:{minimum:number;maximum:number}){
 const parsed=createOrderInput.parse(input),customer=parsed.customerDiscordId;
 await lock(tx,customer);
 // A verified identity prevents ordering benefits for an arbitrary game account.
 const identity=await tx.selectFrom("player_identifiers").select("player_id").where("type","=","discord").where("normalized_value","=",customer).where("verified_at","is not",null).executeTakeFirst();
 if(!identity)throw new ApiError("PLAYER_LINK_REQUIRED",409,"Vincule seu Discord à cidade antes de criar um pedido.");
 const character=parsed.targetCharacterId?await tx.selectFrom("player_characters").selectAll().where("character_id","=",parsed.targetCharacterId).where("player_id","=",identity.player_id).executeTakeFirst():null;
 if(parsed.targetCharacterId&&!character)throw new ApiError("CHARACTER_NOT_OWNED",403,"Personagem não pertence à sua conta.");
 const pending=await tx.selectFrom("orders").select(eb=>eb.fn.countAll<string>().as("count")).where("customer_discord_id","=",customer).where("reservation_status","=","reserved").executeTakeFirstOrThrow();
 if(Number(pending.count)>=3)throw new ApiError("ORDER_LIMIT_REACHED",409,"Conclua ou cancele seus pedidos pendentes.");
 const seen=new Set<string>(),lines=[];
 for(const item of parsed.items){
  if(item.kind==="crypto"){
   const quote=quoteCrypto(item,limits),key="crypto:"+item.mode+":"+item.quantity;
   if(seen.has(key))throw new ApiError("CART_DUPLICATE_ITEM",400,"Agrupe itens repetidos.");seen.add(key);
   lines.push({key,kind:"crypto" as const,name:quote.quantity+" Crypto",quantity:item.units,unitPriceMinor:quote.totalPriceMinor,totalPriceMinor:quote.totalPriceMinor*item.units,stockReserved:false,delivery:{deliveryType:"CRYPTO",deliveryPayload:{amount:quote.quantity*item.units}}});continue;
  }
  if(seen.has(item.productId))throw new ApiError("CART_DUPLICATE_ITEM",400,"Agrupe itens repetidos.");seen.add(item.productId);
  const row=await tx.selectFrom("catalog_products").selectAll().where("product_id","=",item.productId).executeTakeFirst();
  if(!row)throw new ApiError("PRODUCT_UNAVAILABLE",409,"Benefício indisponível.");
  const product=productDto(row),category=await tx.selectFrom("product_categories").selectAll().where("category_id","=",product.categoryId).executeTakeFirst();
  if(product.status!=="active"||category?.data.status!=="active"||!product.salesChannels.includes("SITE_VIP")||product.priceMinor<=0)throw new ApiError("PRODUCT_UNAVAILABLE",409,"Benefício indisponível.");
  if(product.stockMode==="LIMITED"&&product.stockQuantity<item.quantity)throw new ApiError("STOCK_UNAVAILABLE",409,"Estoque insuficiente.");
  if(product.stockMode==="LIMITED")await tx.updateTable("catalog_products").set({data:JSON.stringify({...row.data,stockQuantity:product.stockQuantity-item.quantity}),revision:row.revision+1,updated_at:new Date()}).where("product_id","=",item.productId).execute();
  lines.push({key:product.id,categoryId:product.categoryId,kind:"product" as const,name:product.name,quantity:item.quantity,unitPriceMinor:product.priceMinor,totalPriceMinor:product.priceMinor*item.quantity,stockReserved:product.stockMode==="LIMITED",delivery:{...product.delivery,quantity:item.quantity}});
 }
 if(parsed.couponCode)await tx.selectFrom("coupons").select("coupon_id").where("code","=",parsed.couponCode.trim().toUpperCase()).forUpdate().executeTakeFirst();
 const coupon=parsed.couponCode?await couponDiscount(tx,parsed.couponCode,customer,lines):null;
 const gross=lines.reduce((sum,line)=>sum+line.totalPriceMinor,0),net=coupon?.netAmountMinor??gross;
 if(net<=0)throw new ApiError("ORDER_AMOUNT_INVALID",409,"O valor final deve ser maior que zero.");
 const id=randomUUID(),expiresAt=new Date(Date.now()+30*60*1000);
 const order=await tx.insertInto("orders").values({order_id:id,customer_reference:customer,customer_discord_id:customer,customer_player_id:identity.player_id,target_character_id:character?.character_id??null,target_citizenid_snapshot:character?.citizenid??null,gross_amount_minor:String(gross),discount_amount_minor:String(coupon?.discountAmountMinor??0),amount_minor:String(net),currency:"BRL",coupon_snapshot:coupon?JSON.stringify(coupon):null,reservation_status:"reserved",expires_at:expiresAt}).returningAll().executeTakeFirstOrThrow();
 await tx.insertInto("order_items").values(lines.map(line=>({order_item_id:randomUUID(),order_id:id,product_id:line.key,product_name_at_purchase:line.name,quantity:line.quantity,unit_amount_minor:String(line.unitPriceMinor),amount_minor:String(line.totalPriceMinor),delivery_snapshot:JSON.stringify(line.delivery),stock_reserved:line.stockReserved}))).execute();
 if(coupon)await tx.insertInto("coupon_redemptions").values({redemption_id:randomUUID(),coupon_id:coupon.couponId,order_id:id,customer_discord_id:customer,status:"reserved",snapshot:JSON.stringify(coupon),gross_amount_minor:String(gross),discount_amount_minor:String(coupon.discountAmountMinor),net_amount_minor:String(net)}).execute();
 await adminAudit(tx,ctx,"order.created","order",id,null,null,{customerDiscordId:customer,grossAmountMinor:gross,netAmountMinor:net});
 await enqueueEvent(tx,{type:"order.created",aggregateType:"order",aggregateId:id,payload:{orderId:id,operationId:ctx.operationId},consumers:[],scope:"INSTITUTIONAL"});
 if(lines.some(line=>line.stockReserved))await catalogChanged(tx,ctx,id);
 return {value:{order:orderSummary(order)}};
}
export async function cancelOrder(tx:Tx,ctx:OperationContext,id:string,customer:string){
 await lock(tx,customer);
 const order=await tx.selectFrom("orders").selectAll().where("order_id","=",id).where("customer_discord_id","=",customer).forUpdate().executeTakeFirst();
 if(!order)throw new ApiError("ORDER_NOT_FOUND",404,"Pedido não encontrado.");
 if(order.status==="cancelled")return {value:{order:orderSummary(order)}};
 if(order.status!=="pending"||order.reservation_status!=="reserved"||order.provider_reference!==null)throw new ApiError("ORDER_CANNOT_CANCEL",409,"Pedido requer análise antes do cancelamento.");
 // Never release stock while a PSP payment/preference might still settle.
 if(await tx.selectFrom("payments").select("payment_id").where("order_id","=",id).executeTakeFirst())throw new ApiError("ORDER_CANNOT_CANCEL",409,"Pagamento requer reconciliação antes do cancelamento.");
 const items=await tx.selectFrom("order_items").selectAll().where("order_id","=",id).where("stock_reserved","=",true).execute();
 for(const item of items){const product=await tx.selectFrom("catalog_products").selectAll().where("product_id","=",item.product_id).executeTakeFirstOrThrow();await tx.updateTable("catalog_products").set({data:JSON.stringify({...product.data,stockQuantity:Number(product.data.stockQuantity)+item.quantity}),revision:product.revision+1,updated_at:new Date()}).where("product_id","=",item.product_id).execute();}
 await tx.updateTable("coupon_redemptions").set({status:"released",updated_at:new Date()}).where("order_id","=",id).where("status","=","reserved").execute();
 const row=await tx.updateTable("orders").set({status:"cancelled",reservation_status:"released",updated_at:new Date()}).where("order_id","=",id).returningAll().executeTakeFirstOrThrow();
 await adminAudit(tx,ctx,"order.cancelled","order",id,null,null,{customerDiscordId:customer});
 await enqueueEvent(tx,{type:"order.cancelled",aggregateType:"order",aggregateId:id,payload:{orderId:id,operationId:ctx.operationId},consumers:[],scope:"INSTITUTIONAL"});
 if(items.length)await catalogChanged(tx,ctx,id);
 return {value:{order:orderSummary(row)}};
}
export async function orderDetail(db:Db|Tx,id:string,customer:string){
 const row=await db.selectFrom("orders").selectAll().where("order_id","=",id).where("customer_discord_id","=",customer).executeTakeFirst();
 if(!row)throw new ApiError("ORDER_NOT_FOUND",404,"Pedido não encontrado.");
 const items=await db.selectFrom("order_items").selectAll().where("order_id","=",id).orderBy("order_item_id").execute();
 return {...orderSummary(row),items:items.map(item=>({id:item.order_item_id,name:item.product_name_at_purchase,quantity:item.quantity,unitAmountMinor:item.unit_amount_minor,amountMinor:item.amount_minor}))};
}
`);
write('src/http/orders.ts',`import type {FastifyInstance} from "fastify";
import type {ZodTypeProvider} from "fastify-type-provider-zod";
import {z} from "zod";
import type {Db} from "../database/postgres/types.js";
import type {Config} from "../config/env.js";
import {discordId} from "../contracts/admin.js";
import {createOrderInput,orderSummarySchema,orderDetailSchema} from "../contracts/orders.js";
import {idempotencyHeaders} from "../contracts/allowlist.js";
import {createOrder,cancelOrder,orderSummary,orderDetail} from "../modules/commerce/orders.js";
import {mutate} from "./operations.js";
export function registerOrders(instance:FastifyInstance,db:Db,config:Config){
 const app=instance.withTypeProvider<ZodTypeProvider>(),customer=z.object({customerDiscordId:discordId}).strict(),params=z.object({id:z.uuid()}),mutation=z.object({order:orderSummarySchema,operationId:z.uuid()});
 app.post("/internal/site/orders",{schema:{headers:idempotencyHeaders,body:createOrderInput,response:{200:mutation}}},async req=>mutate(req,db,config,"order.create",req.body,(tx,ctx)=>createOrder(tx,ctx,req.body,{minimum:config.CRYPTO_CUSTOM_MIN,maximum:config.CRYPTO_CUSTOM_MAX})));
 app.post("/internal/site/orders/:id/cancel",{schema:{headers:idempotencyHeaders,params,body:customer,response:{200:mutation}}},async req=>mutate(req,db,config,"order.cancel",{...req.body,id:req.params.id},(tx,ctx)=>cancelOrder(tx,ctx,req.params.id,req.body.customerDiscordId)));
 app.get("/internal/site/orders",{schema:{querystring:customer.extend({page:z.coerce.number().int().min(1).max(100000).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(25)}),response:{200:z.object({items:z.array(orderSummarySchema),page:z.number(),pageSize:z.number(),total:z.number()})}}},async req=>db.transaction().setIsolationLevel("repeatable read").execute(async tx=>{const base=tx.selectFrom("orders").where("customer_discord_id","=",req.query.customerDiscordId),total=await base.select(eb=>eb.fn.countAll<string>().as("count")).executeTakeFirstOrThrow(),rows=await base.selectAll().orderBy("created_at","desc").orderBy("order_id").limit(req.query.pageSize).offset((req.query.page-1)*req.query.pageSize).execute();return {items:rows.map(orderSummary),page:req.query.page,pageSize:req.query.pageSize,total:Number(total.count)};}));
 app.get("/internal/site/orders/:id",{schema:{params,querystring:customer,response:{200:orderDetailSchema}}},async req=>orderDetail(db,req.params.id,req.query.customerDiscordId));
}
`);
edit('src/bootstrap.ts','import { registerCoupons }','import { registerOrders } from "./http/orders.js";\nimport { registerCoupons }');
edit('src/bootstrap.ts','registerCoupons(app, deps.db, config);','registerCoupons(app, deps.db, config);\n  registerOrders(app, deps.db, config);');
edit('src/http/operations.ts','type.startsWith("coupon.")','type.startsWith("coupon.") || type.startsWith("order.")');
// First-purchase discounts include pending reservations; concurrent checkout cannot claim two first purchases.
edit('src/modules/commerce/coupons.ts','.where("status","in",["confirmed","completed"])','.where("status","in",["pending","confirmed","completed"])');
