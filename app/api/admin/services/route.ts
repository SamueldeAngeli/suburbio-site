import { requireAdmin } from '@/lib/permissions/guards';
import { SuburbioApiClient } from '@/lib/api/client';
import { errorResponse } from '@/lib/api/errors';
export const runtime = 'nodejs';
export async function GET() {
  try { await requireAdmin('SERVICES_READ'); return Response.json(await new SuburbioApiClient().health(), { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch (error) { return errorResponse(error); }
}
