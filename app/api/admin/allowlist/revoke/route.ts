import { requireAdmin } from '@/lib/permissions/guards';
import { AllowlistService } from '@/lib/api/modules/allowlist';
import { SiteError, errorResponse } from '@/lib/api/errors';
import { assertOrigin, readJson, limiter } from '@/lib/server/security';
import { serverEnv } from '@/lib/server/env';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    assertOrigin(request.headers, serverEnv().AUTH_URL);
    if (request.headers.get('x-suburbio-intent') !== 'allowlist.revoke') throw new SiteError('INVALID_INPUT', 400);
    const admin = await requireAdmin('ALLOWLIST_REVOKE');
    await limiter.consume(`revoke:${admin.discordId}`, 10);
    const result = await new AllowlistService().revoke(await readJson(request), admin);
    console.info(
      JSON.stringify({
        module: 'allowlist',
        route: 'revoke',
        adminAccountId: admin.adminAccountId,
        discordId: admin.discordId,
        result: 'ok',
        ...result.trace,
      }),
    );
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
