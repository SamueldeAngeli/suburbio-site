// Liveness: the Node process answers. No dependency is consulted here.
export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json({ status: 'ok', service: 'site' }, { headers: { 'Cache-Control': 'no-store' } });
}
