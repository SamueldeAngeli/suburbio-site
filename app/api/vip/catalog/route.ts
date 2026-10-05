import { SuburbioApiClient } from '@/lib/api/client';
import { serverEnv } from '@/lib/server/env';
import { errorResponse } from '@/lib/api/errors';
import { limiter } from '@/lib/server/security';
export async function GET() {
  try {
    await limiter.consume('public-catalog', 300);
    if (!serverEnv().SUBURBIO_API_ENABLED)
      return Response.json({ mode: 'demo' }, { headers: { 'Cache-Control': 'no-store' } });
    const api = new SuburbioApiClient();
    const [catalog, crypto] = await Promise.all([api.catalog(), api.cryptoConfig()]);
    return Response.json(
      { mode: 'live', catalog: catalog.data, crypto: crypto.data },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
