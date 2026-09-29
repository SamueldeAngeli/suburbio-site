import {commerceAmount} from '@/lib/commerce-amount';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {currentSession} from '@/lib/auth/session';
import {SuburbioApiClient} from '@/lib/api/client';
import {safeError} from '@/lib/api/errors';
import {orderStatusLabel} from '@/lib/api/order-contracts';
import {ErrorState} from '@/components/admin/states';
import '../../admin/admin.css';
export const dynamic='force-dynamic';
export const metadata={title:'Meus pedidos — Subúrbio RP',robots:{index:false,follow:false}};
export default async function Orders({searchParams}:{searchParams:Promise<{page?:string}>}){
 const session=await currentSession();if(!session)redirect('/login?returnTo=/minha-conta/pedidos');
 const query=await searchParams,page=Number(query.page??1);let data,error;
 try{data=(await new SuburbioApiClient().orders(session.user.discordId,page)).data;}catch(e){error=safeError(e).body.error;}
 return <main className="admin-root account-page"><Link href="/minha-conta" className="admin-kicker">← MINHA CONTA</Link><div className="admin-title"><span className="admin-kicker">ÁREA DO CIDADÃO</span><h1>Meus pedidos</h1><p>Acompanhe seus benefícios VIP e Crypto. A confirmação de pagamento e a entrega são etapas diferentes.</p></div>{error?<ErrorState message={error.message} reference={error.reference}/>:data&&<section className="admin-panel">{data.items.length===0?<p>Você ainda não tem pedidos registrados.</p>:<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Pedido</th><th>Data</th><th>Valor</th><th>Situação</th><th>Detalhes</th></tr></thead><tbody>{data.items.map(order=><tr key={order.id}><td>{order.id.slice(0,8)}</td><td>{new Date(order.createdAt).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'})}</td><td>{commerceAmount(order.netAmountMinor,order.currency)}</td><td>{orderStatusLabel[order.status]}</td><td><Link href={`/minha-conta/pedidos/${order.id}`}>Ver pedido →</Link></td></tr>)}</tbody></table></div>}<div className="admin-pagination">{page>1&&<Link href={`?page=${page-1}`}>← Anterior</Link>}<span>{data.total} pedido(s)</span>{page*data.pageSize<data.total&&<Link href={`?page=${page+1}`}>Próxima →</Link>}</div></section>}</main>;
}
