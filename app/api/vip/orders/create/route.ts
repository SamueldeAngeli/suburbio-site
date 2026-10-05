import { z } from 'zod';
import { SuburbioApiClient } from '@/lib/api/client';
import { cartInput } from '@/lib/api/cart-contracts';
import { currentSession } from '@/lib/auth/session';
import { assertOrigin, readJson, limiter } from '@/lib/server/security';
import { serverEnv } from '@/lib/server/env';
import { SiteError, errorResponse } from '@/lib/api/errors';
import { giftInput } from '@/lib/api/gift-contracts';
const input = cartInput.extend({ idempotencyKey: z.uuid(), gift: giftInput.optional() });
export async function POST(request: Request) {
  try {
    assertOrigin(request.headers, serverEnv().AUTH_URL);
    if (request.headers.get('x-suburbio-intent') !== 'order.create') throw new SiteError('INVALID_INPUT', 400);
    const session = await currentSession();
    if (!session) throw new SiteError('SESSION_REQUIRED', 401);
    const parsed = input.safeParse(await readJson(request));
    if (!parsed.success) throw new SiteError('INVALID_INPUT', 400);
    await limiter.consume('order-create:' + session.user.discordId, 15);
    const { idempotencyKey, ...cart } = parsed.data;
    return Response.json(await new SuburbioApiClient().createOrder(session.user.discordId, cart, idempotencyKey), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
