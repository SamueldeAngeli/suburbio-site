import Link from 'next/link';
import {redirect} from 'next/navigation';
import {currentSession} from '@/lib/auth/session';
import {SuburbioApiClient} from '@/lib/api/client';
import {safeError} from '@/lib/api/errors';
import {ErrorState} from '@/components/admin/states';
import {EntitlementsTable} from '@/components/entitlements-table';
import '../../admin/admin.css';
export const dynamic='force-dynamic';
export const metadata={title:'Meus benefícios — Subúrbio RP',robots:{index:false,follow:false}};
export default async function Benefits({searchParams}:{searchParams:Promise<{page?:string}>}){
 const session=await currentSession();if(!session)redirect('/login?returnTo=/minha-conta/beneficios');
 const page=Number((await searchParams).page??1);let data,error;try{data=(await new SuburbioApiClient().entitlements(session.user.discordId,page)).data;}catch(e){error=safeError(e).body.error;}
 return <main className="admin-root account-page"><Link className="admin-kicker" href="/minha-conta">← MINHA CONTA</Link><div className="admin-title"><span className="admin-kicker">ÁREA DO CIDADÃO</span><h1>Meus benefícios</h1><p>Acompanhe suas ativações, validades e benefícios permanentes.</p></div>{error?<ErrorState message={error.message} reference={error.reference}/>:data&&<section className="admin-panel"><h2>Benefícios ativos</h2><p className="admin-note">Exibindo os benefícios desta página com status ativo informado pela cidade.</p><EntitlementsTable data={{...data,items:data.items.filter(item=>item.status==='ACTIVE')}}/><h2>Outros benefícios desta página</h2><EntitlementsTable data={{...data,items:data.items.filter(item=>item.status!=='ACTIVE')}}/><div className="admin-pagination">{page>1&&<Link href={`?page=${page-1}`}>← Anterior</Link>}<span>{data.total} benefícios</span>{page*data.pageSize<data.total&&<Link href={`?page=${page+1}`}>Próxima →</Link>}</div></section>}</main>;
}
