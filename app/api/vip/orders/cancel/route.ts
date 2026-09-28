import {z} from 'zod';
import {SuburbioApiClient} from '@/lib/api/client';
import {currentSession} from '@/lib/auth/session';
import {assertOrigin,readJson,limiter} from '@/lib/server/security';
import {serverEnv} from '@/lib/server/env';
import {SiteError,errorResponse} from '@/lib/api/errors';
const input=z.object({id:z.uuid(),idempotencyKey:z.uuid()}).strict();
export async function POST(request:Request){try{
 assertOrigin(request.headers,serverEnv().AUTH_URL);
 if(request.headers.get('x-suburbio-intent')!=='order.cancel')throw new SiteError('INVALID_INPUT',400);
 const session=await currentSession();if(!session)throw new SiteError('SESSION_REQUIRED',401);
 const parsed=input.safeParse(await readJson(request));if(!parsed.success)throw new SiteError('INVALID_INPUT',400);
 limiter.consume(`order-cancel:${session.user.discordId}`,15);
 return Response.json(await new SuburbioApiClient().cancelOrder(session.user.discordId,parsed.data.id,parsed.data.idempotencyKey),{headers:{'Cache-Control':'private, no-store'}});
}catch(error){return errorResponse(error);}}
