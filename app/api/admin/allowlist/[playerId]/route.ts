import { requireAdmin } from '@/lib/permissions/guards';
import { AllowlistService } from '@/lib/api/modules/allowlist';
import { errorResponse } from '@/lib/api/errors';
export const runtime = 'nodejs';
export async function GET(_request: Request, context: { params: Promise<{ playerId: string }> }) {
  try {
    await requireAdmin('ALLOWLIST_READ');
    const { playerId } = await context.params;
    return Response.json(await new AllowlistService().get(playerId), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
