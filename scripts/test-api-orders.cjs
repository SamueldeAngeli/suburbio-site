const fs=require('node:fs');
fs.writeFileSync('D:/api suburbio/tests/integration/orders.test.ts',`import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {setup} from "./helpers.js";
import {bootstrapOwner} from "../../src/modules/admin/bootstrap.js";
let env:Awaited<ReturnType<typeof setup>>,productId:string;
const owner="111111111111111111",customers=["222222222222222222","333333333333333333","444444444444444444","555555555555555555"];
const crypto={kind:"crypto",mode:"package",quantity:300};
const coupon={code:"ONLYONCE",discountType:"percentage",discountValue:15,minimumAmountMinor:0,startsAt:null,expiresAt:null,maxUses:1,maxUsesPerUser:1,scope:"CRYPTO",productIds:[],categoryIds:[],firstPurchaseOnly:false,status:"active"};
before(async()=>{
 env=await setup({SERVICE_RATE_LIMIT:"10000"});await bootstrapOwner(env.db,{...env.config,BOOTSTRAP_OWNER_ENABLED:true,BOOTSTRAP_OWNER_DISCORD_ID:owner});
 for(const customer of customers){const player=randomUUID();await env.db.insertInto("players").values({player_id:player}).execute();await env.db.insertInto("player_identifiers").values({id:randomUUID(),player_id:player,type:"discord",value:customer,normalized_value:customer,verified_at:new Date()}).execute();}
 const cat=await env.request("site","/internal/site/categories",{actorDiscordId:owner,category:{name:"VIP",slug:"vip",description:"VIP",status:"active",displayOrder:0}});assert.equal(cat.statusCode,200,cat.body);
 const p=await env.request("site","/internal/site/products",{actorDiscordId:owner,product:{name:"Último VIP",slug:"ultimo",description:"Benefício",categoryId:cat.json().category.id,imageUrl:"",status:"active",displayOrder:0,salesChannels:["SITE_VIP"],priceCrypto:0,priceMinor:10000,stockMode:"LIMITED",stockQuantity:1,delivery:{deliveryType:"VIP",deliveryPayload:{plan:"gold",days:30}}}});assert.equal(p.statusCode,200,p.body);productId=p.json().product.id;
 assert.equal((await env.request("site","/internal/site/coupons",{actorDiscordId:owner,coupon})).statusCode,200);
});
after(async()=>{await env?.close();});
test("pedido exige vínculo verificado, não aceita preço ou outro personagem",async()=>{
 assert.equal((await env.request("site","/internal/site/orders",{customerDiscordId:owner,items:[crypto]})).statusCode,409);
 assert.equal((await env.request("site","/internal/site/orders",{customerDiscordId:customers[0],items:[crypto],netAmountMinor:1})).statusCode,400);
 assert.equal((await env.request("site","/internal/site/orders",{customerDiscordId:customers[0],items:[crypto],targetCharacterId:randomUUID()})).statusCode,403);
});
test("pedidos concorrentes não ultrapassam estoque; cancelamento restaura uma única vez",async()=>{
 const replies=await Promise.all(customers.slice(0,2).map(customerDiscordId=>env.request("site","/internal/site/orders",{customerDiscordId,items:[{kind:"product",productId,quantity:1}]})));
 assert.deepEqual(replies.map(r=>r.statusCode).sort(),[200,409]);const winner=replies.findIndex(r=>r.statusCode===200),id=replies[winner]!.json().order.id,customerDiscordId=customers[winner]!;
 assert.equal((await env.db.selectFrom("catalog_products").selectAll().where("product_id","=",productId).executeTakeFirstOrThrow()).data.stockQuantity,0);
 const snapshot=(await env.db.selectFrom("order_items").selectAll().where("order_id","=",id).executeTakeFirstOrThrow()).delivery_snapshot;assert.equal(snapshot?.deliveryType,"VIP");
 for(let i=0;i<2;i++)assert.equal((await env.request("site","/internal/site/orders/"+id+"/cancel",{customerDiscordId})).statusCode,200);
 assert.equal((await env.db.selectFrom("catalog_products").selectAll().where("product_id","=",productId).executeTakeFirstOrThrow()).data.stockQuantity,1);
 assert.equal(await env.db.selectFrom("admin_audit_events").selectAll().where("target_id","=",id).execute().then(r=>r.length),2);
});
test("reserva concorrente de cupom respeita limite global e preserva 300 Crypto",async()=>{
 const replies=await Promise.all(customers.slice(0,2).map(customerDiscordId=>env.request("site","/internal/site/orders",{customerDiscordId,items:[crypto],couponCode:"ONLYONCE"})));
 assert.deepEqual(replies.map(r=>r.statusCode).sort(),[200,409]);const winner=replies.findIndex(r=>r.statusCode===200),order=replies[winner]!.json().order;
 assert.equal(order.netAmountMinor,"30600");assert.equal(order.status,"pending");assert.equal(order.reservationStatus,"reserved");
 const item=await env.db.selectFrom("order_items").selectAll().where("order_id","=",order.id).executeTakeFirstOrThrow();assert.deepEqual(item.delivery_snapshot,{deliveryType:"CRYPTO",deliveryPayload:{amount:300}});
 const redemption=await env.db.selectFrom("coupon_redemptions").selectAll().where("order_id","=",order.id).executeTakeFirstOrThrow();assert.equal(redemption.status,"reserved");
 await env.request("site","/internal/site/orders/"+order.id+"/cancel",{customerDiscordId:customers[winner]});
 assert.equal((await env.request("site","/internal/site/orders",{customerDiscordId:customers[0],items:[crypto],couponCode:"ONLYONCE"})).statusCode,200);
});
test("retry idempotente gera só um pedido; consulta protege propriedade",async()=>{
 const body={customerDiscordId:customers[2],items:[crypto]},key=randomUUID();const replies=await Promise.all([env.request("site","/internal/site/orders",body,key),env.request("site","/internal/site/orders",body,key)]);
 assert.equal(replies[0]!.statusCode,200,replies[0]!.body);assert.deepEqual(replies[0]!.json(),replies[1]!.json());const id=replies[0]!.json().order.id;
 assert.equal((await env.request("site","/internal/site/orders/"+id+"?customerDiscordId="+customers[3])).statusCode,404);
 assert.equal((await env.request("site","/internal/site/orders/"+id+"/cancel",{customerDiscordId:customers[3]})).statusCode,404);
 const detail=await env.request("site","/internal/site/orders/"+id+"?customerDiscordId="+customers[2]);assert.equal(detail.statusCode,200);assert.equal(detail.json().items.length,1);assert.ok(!detail.body.includes("deliveryPayload"));
 assert.equal((await env.request("fivem-bridge","/internal/site/orders/"+id+"?customerDiscordId="+customers[2])).statusCode,403);
});
test("falha após descontar estoque reverte toda a reserva",async()=>{
 const reply=await env.request("site","/internal/site/orders",{customerDiscordId:customers[3],items:[{kind:"product",productId,quantity:1}],couponCode:"INEXISTENTE"});assert.equal(reply.statusCode,409);
 assert.equal((await env.db.selectFrom("catalog_products").selectAll().where("product_id","=",productId).executeTakeFirstOrThrow()).data.stockQuantity,1);
});
test("primeira compra não pode ser reservada duas vezes",async()=>{
 await env.request("site","/internal/site/coupons",{actorDiscordId:owner,coupon:{...coupon,code:"FIRST",maxUses:null,maxUsesPerUser:null,firstPurchaseOnly:true}});
 const body={customerDiscordId:customers[3],items:[crypto],couponCode:"FIRST"};const replies=await Promise.all([env.request("site","/internal/site/orders",body),env.request("site","/internal/site/orders",body)]);assert.deepEqual(replies.map(r=>r.statusCode).sort(),[200,409]);
});
`);
