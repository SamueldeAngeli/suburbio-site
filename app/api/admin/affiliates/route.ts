import { z } from 'zod';
import { affiliateMutation, payoutInput } from '@/lib/api/affiliate-contracts';
import { SuburbioApiClient } from '@/lib/api/client';
import { requireAdmin } from '@/lib/permissions/guards';
import { SiteError, errorResponse } from '@/lib/api/errors';
import { assertOrigin, readJson, limiter } from '@/lib/server/security';
import { serverEnv } from '@/lib/server/env';
const input = z.discriminatedUnion('action', [
  z
    .object({ action: z.literal('save'), id: z.uuid().optional(), data: affiliateMutation, idempotencyKey: z.uuid() })
    .strict(),
  z.object({ action: z.literal('payout'), id: z.uuid(), data: payoutInput, idempotencyKey: z.uuid() }).strict(),
]);
export async function POST(request: Request) {
  try {
    assertOrigin(request.headers, serverEnv().AUTH_URL);
    if (request.headers.get('x-suburbio-intent') !== 'affiliate.write') throw new SiteError('INVALID_INPUT', 400);
    const parsed = input.safeParse(await readJson(request, 16000));
    if (!parsed.success) throw new SiteError('INVALID_INPUT', 400);
    const v = parsed.data,
      admin = await requireAdmin(v.action === 'save' ? 'AFFILIATES_MANAGE' : 'AFFILIATES_PAYOUT_MANAGE');
    if (admin.readOnly) throw new SiteError('API_READ_ONLY');
    await limiter.consume('affiliate-write:' + admin.discordId, 20);
    const api = new SuburbioApiClient(),
      result =
        v.action === 'save'
          ? await api.saveAffiliate(admin.discordId, v.data, v.idempotencyKey, v.id)
          : await api.affiliatePayout(admin.discordId, v.id, v.data, v.idempotencyKey);
    return Response.json(result.data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
