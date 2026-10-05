import { readiness } from '@/lib/server/readiness';

export const dynamic = 'force-dynamic';
export async function GET() {
  const result = await readiness();
  return Response.json(
    { status: result.ready ? 'ready' : 'not_ready', service: 'site', checks: result.checks },
    { status: result.ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
