import { SuburbioApiClient } from '@/lib/api/client';
import { assertOrigin, readJson, limiter } from '@/lib/server/security';
import { serverEnv } from '@/lib/server/env';
import { SiteError, errorResponse } from '@/lib/api/errors';
import { currentSession } from '@/lib/auth/session';
export async function POST(request: Request) {
  try {
    assertOrigin(request.headers, serverEnv().AUTH_URL);
    if (request.headers.get('x-suburbio-intent') !== 'cart.quote') throw new SiteError('INVALID_INPUT', 400);
    const session = await currentSession();
    if (!session?.user?.discordId) throw new SiteError('SESSION_REQUIRED', 401);
    await limiter.consume(`cart-quote:${session.user.discordId}`, 30);
    return Response.json(await new SuburbioApiClient().cartQuote(await readJson(request), session.user.discordId), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
