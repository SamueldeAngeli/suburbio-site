import { type NextRequest } from 'next/server';
import { handlers } from '@/auth';
import { serverEnv } from '@/lib/server/env';
import { assertOrigin, limiter } from '@/lib/server/security';
import { SiteError, errorResponse } from '@/lib/api/errors';
export const runtime = 'nodejs';
async function handle(request: NextRequest) {
  try {
    const env = serverEnv();
    if (!env.AUTH_ENABLED) throw new SiteError('API_NOT_CONFIGURED');
    await limiter.consume('oauth-http', 240);
    if (request.nextUrl.pathname.includes('/callback/')) await limiter.consume('oauth-callback', 60);
    if (request.method === 'POST') assertOrigin(request.headers, env.AUTH_URL);
    return request.method === 'POST' ? handlers.POST(request) : handlers.GET(request);
  } catch (error) {
    return errorResponse(error);
  }
}
export const GET = handle;
export const POST = handle;
