import Link from 'next/link';
import type {z} from 'zod';
import type {orderDetailSchema} from '@/lib/api/order-contracts';
const status:Record<string,string>={pending:'Pendente',approved:'Aprovado',rejected:'Rejeitado',failed:'Falhou',cancelled:'Cancelado',expired:'Expirado',review:'Em análise',processing:'Em processamento',processed:'Enviada'};
export function PurchaseStages({order}:{order:z.infer<typeof orderDetailSchema>}){return <div className="account-grid">
 <section className="admin-panel"><h2>Pagamento</h2><p>{order.paymentStatus?status[order.paymentStatus]:'Informação indisponível'}</p>{order.payments?.map(p=><p key={p.id}>{status[p.status]??p.status} · {(Number(p.amountMinor)/100).toLocaleString('pt-BR',{style:'currency',currency:p.currency})}{p.paidAt?' · '+new Date(p.paidAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):''}</p>)}</section>
 <section className="admin-panel"><h2>Entrega</h2><p>{order.deliveryStatus==='delivered'?'Compra entregue':order.deliveryStatus==='pending'?'Aguardando confirmação de entrega':'Informação indisponível'}</p>{order.deliveries?.map(d=><p key={d.id}>{d.product}: {d.status==='DELIVERED'?'Entregue':d.lastError==='PLAYER_OFFLINE'?'Aguardando sua entrada na cidade':'Pendente'}{d.deliveredAt?' · '+new Date(d.deliveredAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):''}</p>)}</section>
 <section className="admin-panel"><h2>Benefícios</h2><p>A validade começa após a confirmação da ativação.</p><Link href="/minha-conta/beneficios">Consultar benefícios e validade →</Link></section>
 <section className="admin-panel"><h2>Notificação Discord</h2>{order.notifications?.length?order.notifications.map(n=><p key={n.kind}>{n.kind==='payment.approved'?'Pagamento aprovado':'Compra entregue'}: {status[n.status]??n.status}{n.lastError==='DISCORD_DM_CLOSED'?' · Suas mensagens diretas estão fechadas.':''}</p>):<p>Nenhuma notificação registrada.</p>}</section>
 </div>;}
