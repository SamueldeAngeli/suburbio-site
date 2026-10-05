import { affiliateCode } from '@/lib/api/affiliate-contracts';
import { SuburbioApiClient } from '@/lib/api/client';
import { SiteError, errorResponse } from '@/lib/api/errors';
import { limiter } from '@/lib/server/security';
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    if ([...params.keys()].some((k) => k !== 'code')) throw new SiteError('INVALID_INPUT', 400);
    const parsed = affiliateCode.safeParse(params.get('code'));
    if (!parsed.success) throw new SiteError('INVALID_INPUT', 400);
    await limiter.consume('referral:global', 300);
    return Response.json((await new SuburbioApiClient().referral(parsed.data)).data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
