import { z } from 'zod';
import { productInput } from '@/lib/api/catalog-contracts';
import { SuburbioApiClient } from '@/lib/api/client';
import { requireAdmin } from '@/lib/permissions/guards';
import { assertCapability } from '@/lib/permissions/policy';
import { SiteError, errorResponse } from '@/lib/api/errors';
import { assertOrigin, readJson, limiter } from '@/lib/server/security';
import { serverEnv } from '@/lib/server/env';
const input=z.object({product:productInput,id:z.uuid().optional(),expectedRevision:z.number().int().positive().optional(),idempotencyKey:z.string().regex(/^[A-Za-z0-9:_-]{8,128}$/)}).strict();
export async function POST(request:Request){
  try{
    assertOrigin(request.headers,serverEnv().AUTH_URL);
    if(request.headers.get('x-suburbio-intent')!=='product.save')throw new SiteError('INVALID_INPUT',400);
    const parsed=input.safeParse(await readJson(request,14000));
    if(!parsed.success)throw new SiteError('INVALID_INPUT',400);
    const value=parsed.data,admin=await requireAdmin(value.id?'PRODUCTS_UPDATE':'PRODUCTS_CREATE');
    if(admin.readOnly)throw new SiteError('API_READ_ONLY');
    if(value.product.status!=='active')assertCapability(admin,'PRODUCTS_DISABLE');
    limiter.consume(`product:${admin.discordId}`,20);
    return Response.json(await new SuburbioApiClient().saveProduct(admin.discordId,value.product,value.idempotencyKey,value.id,value.expectedRevision),{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return errorResponse(error);}
}
