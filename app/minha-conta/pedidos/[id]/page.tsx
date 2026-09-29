import {commerceAmount} from '@/lib/commerce-amount';
import {PurchaseStages} from '@/components/purchase-stages';
import {CheckoutOrder} from '@/components/checkout-order';
import Link from 'next/link';
import {validityLabel} from '@/lib/validity';
import {redirect,notFound} from 'next/navigation';
import {z} from 'zod';
import {currentSession} from '@/lib/auth/session';
import {SuburbioApiClient} from '@/lib/api/client';
import {safeError} from '@/lib/api/errors';
import {orderStatusLabel} from '@/lib/api/order-contracts';
import {ErrorState} from '@/components/admin/states';
import {CancelOrder} from '@/components/cancel-order';
import '../../../admin/admin.css';
export const dynamic='force-dynamic';
export const metadata={title:'Detalhes do pedido — Subúrbio RP',robots:{index:false,follow:false}};
export default async function Order({params}:{params:Promise<{id:string}>}){
 const {id}=await params,session=await currentSession();if(!session)redirect('/login?returnTo=/minha-conta/pedidos');if(!z.uuid().safeParse(id).success)notFound();
 let data,error;try{data=(await new SuburbioApiClient().order(session.user.discordId,id)).data;}catch(e){error=safeError(e).body.error;}
 const currency=data?.currency??'BRL';
 const money=(v:string)=>commerceAmount(v,currency);
 return <main className="admin-root account-page"><Link href="/minha-conta/pedidos" className="admin-kicker">← MEUS PEDIDOS</Link><div className="admin-title"><h1>Pedido {id.slice(0,8)}</h1><p>{data?orderStatusLabel[data.status]:'Detalhes do seu pedido'}</p></div>{error?<ErrorState message={error.message} reference={error.reference}/>:data&&<><section className="admin-panel"><h2>Pedido</h2><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Benefício</th><th>Validade adquirida</th><th>Quantidade</th><th>Valor</th></tr></thead><tbody>{data.items.map(item=><tr key={item.id}><td>{item.name}</td><td>{validityLabel({validityMode:item.validityModeSnapshot,durationDays:item.durationDaysSnapshot})}</td><td>{item.quantity}</td><td>{money(item.amountMinor)}</td></tr>)}</tbody></table></div><p>Subtotal: {money(data.grossAmountMinor)}</p><p>Desconto: {money(data.discountAmountMinor)}</p><p><strong>Total: {money(data.netAmountMinor)}</strong></p><p>O pagamento confirmado não significa que os benefícios já foram entregues. A entrega depende da confirmação da cidade.</p>{data.status==='pending'&&<><CheckoutOrder id={id}/>{data.reservationStatus==='reserved'&&<CancelOrder id={id}/>}</>}</section><PurchaseStages order={data}/></>}</main>;
}
