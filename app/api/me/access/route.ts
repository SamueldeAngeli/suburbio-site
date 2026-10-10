import { currentSession } from '@/lib/auth/session';
import { SuburbioApiClient } from '@/lib/api/client';
import { AccountService } from '@/lib/api/modules/accounts';
import { SiteError, errorResponse } from '@/lib/api/errors';
import { limiter } from '@/lib/server/security';
import { logEvent } from '@/lib/server/log';
export async function GET(request: Request) {
  try {
    const session = await currentSession();
    if (!session) throw new SiteError('SESSION_REQUIRED', 401);
    if (new URL(request.url).search) throw new SiteError('INVALID_INPUT', 400);
    const id = session.user.discordId;
    await limiter.consume('access:' + id, 60);
    const [affiliate, admin] = await Promise.allSettled([
      new SuburbioApiClient().affiliateAccess(id),
      new AccountService().resolve(id),
    ]);
    // Falha fechada (botão oculto), mas diagnosticável: só o código, sem identificadores nem segredos.
    // 403 é o caso normal de quem não é admin e não é registrado.
    if (admin.status === 'rejected' && !(admin.reason instanceof SiteError && admin.reason.status === 403))
      logEvent('warn', 'access.admin_unresolved', {
        code: admin.reason instanceof SiteError ? admin.reason.code : 'INTERNAL_ERROR',
        status: admin.reason instanceof SiteError ? admin.reason.status : 500,
      });
    return Response.json(
      {
        affiliate: affiliate.status === 'fulfilled' && affiliate.value.data.affiliate === true,
        admin:
          admin.status === 'fulfilled' &&
          admin.value.admin?.status === 'active' &&
          (admin.value.admin.fullAccess || admin.value.admin.capabilities.length > 0),
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
