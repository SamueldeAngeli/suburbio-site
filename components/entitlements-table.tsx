import Link from 'next/link';
import type {z} from 'zod';
import type {entitlementsPage} from '@/lib/api/entitlement-contracts';
import {entitlementStatus,remainingLabel} from '@/lib/entitlements';
const date=(v:string|null)=>v?new Date(v).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'—';
export function EntitlementsTable({data,admin=false}:{data:z.infer<typeof entitlementsPage>;admin?:boolean}){
 return <><p className="admin-note">A validade começa na ativação confirmada na cidade. Datas no horário de Brasília.</p>{data.items.length===0?<p>Nenhum benefício registrado.</p>:<div className="admin-table-wrap"><table><thead><tr><th>Produto</th><th>Status</th><th>{admin?'startsAt':'Ativado em'}</th><th>{admin?'expiresAt':'Expira em'}</th><th>Tempo restante</th>{admin&&<><th>Tipo</th><th>Pedido de origem</th><th>Fulfillment</th><th>Origem</th></>}</tr></thead><tbody>{data.items.map(e=><tr key={e.id}><td>{e.productName}</td><td>{entitlementStatus[e.status]}</td><td>{date(e.startsAt)}</td><td>{e.expiresAt?date(e.expiresAt):e.status==='PENDING'?'Após ativação':'Sem vencimento'}</td><td>{remainingLabel(e.status,e.expiresAt,data.asOf)}</td>{admin&&<><td>{e.type}</td><td><Link href={`/admin/orders/${e.orderId}`}>{e.orderId.slice(0,8)}</Link></td><td><code>{e.fulfillmentId}</code></td><td>Área VIP</td></>}</tr>)}</tbody></table></div>}</>;
}
