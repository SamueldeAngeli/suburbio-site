const fs=require('node:fs'),path=require('node:path'),root='D:/api suburbio/';
function write(p,s){fs.mkdirSync(path.dirname(root+p),{recursive:true});fs.writeFileSync(root+p,s)}
function edit(p,a,b){const s=fs.readFileSync(root+p,'utf8');if(!s.includes(a))throw Error(p+' anchor');fs.writeFileSync(root+p,s.replace(a,b))}
edit('src/config/env.ts','    API_READ_ONLY: bool("false"),',`    API_READ_ONLY: bool("false"),
    MERCADO_PAGO_ENABLED: bool("false"),
    MERCADO_PAGO_ACCESS_TOKEN: z.string().default(""),
    MERCADO_PAGO_WEBHOOK_SECRET: z.string().default(""),
    MERCADO_PAGO_COLLECTOR_ID: z.string().default(""),
    MERCADO_PAGO_LIVE_MODE: bool("false"),
    MERCADO_PAGO_RETURN_URL: z.string().default(""),
    MERCADO_PAGO_NOTIFICATION_URL: z.string().default(""),`);
edit('src/config/env.ts','    if(v.CRYPTO_CUSTOM_MIN',`    if(v.MERCADO_PAGO_ENABLED){
      if(v.MERCADO_PAGO_ACCESS_TOKEN.length<20||v.MERCADO_PAGO_WEBHOOK_SECRET.length<20||!/^\\d{1,20}$/.test(v.MERCADO_PAGO_COLLECTOR_ID))fail("Credenciais Mercado Pago incompletas");
      for(const url of [v.MERCADO_PAGO_RETURN_URL,v.MERCADO_PAGO_NOTIFICATION_URL]){try{const parsed=new URL(url);if(parsed.protocol!=="https:"||parsed.username||parsed.password||parsed.hash)fail("Mercado Pago exige URLs HTTPS válidas");}catch{fail("Mercado Pago exige URLs HTTPS válidas");}}
    }
    if(v.CRYPTO_CUSTOM_MIN`);
write('src/modules/commerce/mercadopago.ts',`import {createHmac,timingSafeEqual} from "node:crypto";
import {z} from "zod";
import type {Config} from "../../config/env.js";
import {ApiError} from "../../http/errors.js";
const identifier=z.union([z.number().int().positive().max(Number.MAX_SAFE_INTEGER),z.string().regex(/^[0-9]{1,20}$/)]).transform(String);
export const paymentSchema=z.object({id:identifier,status:z.string().max(80),collector_id:identifier,external_reference:z.string().max(150).nullable(),currency_id:z.string(),transaction_amount:z.union([z.number(),z.string()]),transaction_amount_refunded:z.union([z.number(),z.string()]).default(0),live_mode:z.boolean(),date_last_updated:z.string(),date_approved:z.string().nullable().optional()});
export function moneyToMinor(value:string|number){const text=String(value);if(!/^\\d+(?:\\.\\d{1,2})?$/.test(text))throw new ApiError("PAYMENT_INVALID_AMOUNT",502,"Valor inválido no provedor.");const [whole,fraction=""]=text.split("."),amount=BigInt(whole!)*100n+BigInt(fraction.padEnd(2,"0"));if(amount>BigInt(Number.MAX_SAFE_INTEGER))throw new ApiError("PAYMENT_INVALID_AMOUNT",502,"Valor inválido no provedor.");return Number(amount);}
export function verifyPaymentSignature(secret:string,signature:unknown,requestId:unknown,dataId:unknown,now=Date.now()){
 const deny=()=>new ApiError("PAYMENT_SIGNATURE_INVALID",401,"Notificação não autenticada.");
 if(!secret||typeof signature!=="string"||typeof requestId!=="string"||!/^[a-zA-Z0-9_-]{1,128}$/.test(requestId)||typeof dataId!=="string"||!/^\\d{1,20}$/.test(dataId))throw deny();
 const fields=signature.split(",").map(v=>v.trim().split("="));if(fields.length!==2||new Set(fields.map(f=>f[0])).size!==2)throw deny();
 const parts=Object.fromEntries(fields),ts=parts.ts,v1=parts.v1;
 if(!ts||!/^\\d{10}(?:\\d{3})?$/.test(ts)||!v1||!/^([a-f0-9]{64})$/i.test(v1))throw deny();
 const timestamp=ts.length===13?Number(ts):Number(ts)*1000;if(Math.abs(now-timestamp)>300000)throw deny();
 const expected=createHmac("sha256",secret).update("id:"+dataId+";request-id:"+requestId+";ts:"+ts+";").digest();
 if(!timingSafeEqual(expected,Buffer.from(v1,"hex")))throw deny();return dataId;
}
export class MercadoPago {
 constructor(private config:Config,private transport:typeof fetch=fetch){}
 private async request(path:string,body?:unknown){
  if(!this.config.MERCADO_PAGO_ENABLED)throw new ApiError("PAYMENT_DISABLED",503,"Pagamento indisponível neste ambiente.");
  let response:Response;try{response=await this.transport("https://api.mercadopago.com"+path,{method:body?"POST":"GET",headers:{Authorization:"Bearer "+this.config.MERCADO_PAGO_ACCESS_TOKEN,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{}),redirect:"error",signal:AbortSignal.timeout(8000)});}catch{throw new ApiError("PAYMENT_PROVIDER_UNAVAILABLE",503,"Provedor de pagamento indisponível.");}
  if(!response.ok)throw new ApiError("PAYMENT_PROVIDER_UNAVAILABLE",503,"Provedor de pagamento indisponível.");
  try{const text=await response.text();if(text.length>1000000)throw Error();return JSON.parse(text) as unknown;}catch{throw new ApiError("PAYMENT_PROVIDER_INVALID",502,"Resposta inválida do provedor.");}
 }
 async payment(id:string){if(!/^\\d{1,20}$/.test(id))throw new ApiError("PAYMENT_ID_INVALID",400,"Pagamento inválido.");const result=paymentSchema.safeParse(await this.request("/v1/payments/"+id));if(!result.success||result.data.id!==id)throw new ApiError("PAYMENT_PROVIDER_INVALID",502,"Resposta inválida do provedor.");return result.data;}
 async preference(order:{id:string;amountMinor:number;expiresAt:Date}){
  if(!z.uuid().safeParse(order.id).success||!Number.isSafeInteger(order.amountMinor)||order.amountMinor<=0||order.expiresAt.getTime()<=Date.now())throw new ApiError("ORDER_AMOUNT_INVALID",409,"Pedido inválido para pagamento.");
  const target=new URL(this.config.MERCADO_PAGO_RETURN_URL);target.searchParams.set("order",order.id);
  const body={items:[{id:order.id,title:"Subúrbio RP — benefícios VIP e Crypto",quantity:1,currency_id:"BRL",unit_price:order.amountMinor/100}],external_reference:order.id,notification_url:this.config.MERCADO_PAGO_NOTIFICATION_URL,back_urls:{success:target.toString(),failure:target.toString(),pending:target.toString()},auto_return:"approved",expires:true,expiration_date_to:order.expiresAt.toISOString()};
  const result=z.object({id:z.string().min(1).max(200),init_point:z.url(),sandbox_init_point:z.url(),collector_id:identifier}).safeParse(await this.request("/checkout/preferences",body));
  if(!result.success||result.data.collector_id!==this.config.MERCADO_PAGO_COLLECTOR_ID)throw new ApiError("PAYMENT_PROVIDER_INVALID",502,"Conta recebedora inválida.");
  const checkoutUrl=this.config.MERCADO_PAGO_LIVE_MODE?result.data.init_point:result.data.sandbox_init_point,url=new URL(checkoutUrl);
  if(url.protocol!=="https:"||url.username||url.password||!["www.mercadopago.com.br","sandbox.mercadopago.com.br"].includes(url.hostname))throw new ApiError("PAYMENT_PROVIDER_INVALID",502,"Endereço de pagamento inválido.");
  return {preferenceId:result.data.id,checkoutUrl};
 }
}
export function assertPaymentMatches(payment:z.infer<typeof paymentSchema>,order:{id:string;amountMinor:string},config:Config){
 if(payment.external_reference!==order.id||payment.collector_id!==config.MERCADO_PAGO_COLLECTOR_ID||payment.currency_id!=="BRL"||payment.live_mode!==config.MERCADO_PAGO_LIVE_MODE||String(moneyToMinor(payment.transaction_amount))!==order.amountMinor)throw new ApiError("PAYMENT_ORDER_MISMATCH",409,"Pagamento divergente do pedido.");
}
`);
fs.appendFileSync(root+'.env.example',`\n# Mercado Pago — somente API; manter desabilitado até homologar checkout/fulfillment\nMERCADO_PAGO_ENABLED=false\nMERCADO_PAGO_ACCESS_TOKEN=\nMERCADO_PAGO_WEBHOOK_SECRET=\nMERCADO_PAGO_COLLECTOR_ID=\nMERCADO_PAGO_LIVE_MODE=false\nMERCADO_PAGO_RETURN_URL=\nMERCADO_PAGO_NOTIFICATION_URL=\n`);
