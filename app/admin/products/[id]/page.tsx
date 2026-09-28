import { ProductDetails } from '@/components/admin/product-details';
import { notFound } from 'next/navigation';
import { pageAccess } from '@/lib/permissions/guards';
import { can } from '@/lib/permissions/policy';
import { SuburbioApiClient } from '@/lib/api/client';
import { uuid } from '@/lib/api/contracts';
import { safeError } from '@/lib/api/errors';
import { AccessUnavailable, ErrorState } from '@/components/admin/states';
import { ProductEditor } from '@/components/admin/product-editor';
export default async function Page({params}:{params:Promise<{id:string}>}){
  const {id}=await params;const isNew=id==='new';
  const admin=await pageAccess(isNew?'PRODUCTS_CREATE':'PRODUCTS_UPDATE',`/admin/products/${id}`);if(!admin)return <AccessUnavailable/>;
  if(!isNew&&!uuid.safeParse(id).success)notFound();if(admin.readOnly)return <ErrorState message="A API está em modo somente leitura."/>;
  let categories,product;try{const client=new SuburbioApiClient();categories=(await client.categories(admin.discordId)).data.items;product=isNew?undefined:(await client.product(admin.discordId,id)).data;}catch(error){const safe=safeError(error);return <ErrorState message={safe.body.error.message} reference={safe.body.error.reference}/>;}
  return <><div className="admin-title"><span className="admin-kicker">GESTÃO / CATÁLOGO</span><h1>{isNew?'Novo produto':product?.name}</h1><p>Benefícios, disponibilidade e entrega em um só cadastro.</p></div>{product&&<ProductDetails product={product}/>}<ProductEditor product={product} categories={categories} canDisable={can(admin,'PRODUCTS_DISABLE')}/></>;
}
