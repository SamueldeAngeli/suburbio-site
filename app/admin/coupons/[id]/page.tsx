import {notFound,forbidden} from 'next/navigation';
import {pageAccess} from '@/lib/permissions/guards';
import {SuburbioApiClient} from '@/lib/api/client';
import {safeError} from '@/lib/api/errors';
import {uuid} from '@/lib/api/contracts';
import {AccessUnavailable,ErrorState} from '@/components/admin/states';
import {CouponEditor} from '@/components/admin/coupon-editor';
export default async function Page({params}:{params:Promise<{id:string}>}){
  const {id}=await params,isNew=id==='new';const admin=await pageAccess(isNew?'COUPONS_CREATE':'COUPONS_READ',`/admin/coupons/${id}`);if(!admin)return <AccessUnavailable/>;if(isNew&&!admin.fullAccess)forbidden();if(!isNew&&!uuid.safeParse(id).success)notFound();
  let coupon,catalog;try{const client=new SuburbioApiClient();coupon=isNew?undefined:(await client.coupon(admin.discordId,id)).data;catalog=admin.fullAccess?(await client.catalog()).data:undefined;}catch(error){const e=safeError(error);return <ErrorState message={e.body.error.message}/>;}
  return <><div className="admin-title"><span className="admin-kicker">GESTÃO / CUPONS</span><h1>{coupon?.code??'Novo cupom'}</h1><p>Benefícios com regras claras e histórico preservado.</p></div>{coupon&&<div className="admin-metrics"><article><span>Usos aplicados</span><strong>{coupon.metrics.usesCount}</strong></article><article><span>Vendas líquidas</span><strong>{(Number(coupon.metrics.netSalesMinor)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong></article></div>}{admin.fullAccess&&!admin.readOnly&&catalog?<CouponEditor coupon={coupon} products={catalog.products} categories={catalog.categories}/>:<p className="admin-note">Edição exclusiva do proprietário.</p>}</>;
}
