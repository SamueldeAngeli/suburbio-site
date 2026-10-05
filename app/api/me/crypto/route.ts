import { currentSession } from '@/lib/auth/session';
import { SuburbioApiClient } from '@/lib/api/client';
import { SiteError, errorResponse } from '@/lib/api/errors';
import { limiter } from '@/lib/server/security';
export async function GET(request: Request) {
  try {
    const session = await currentSession();
    if (!session) throw new SiteError('SESSION_REQUIRED', 401);
    if (new URL(request.url).search) throw new SiteError('INVALID_INPUT', 400);
    await limiter.consume(`balance:${session.user.discordId}`, 60);
    const { data } = await new SuburbioApiClient().citizenBalance(session.user.discordId);
    return Response.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
