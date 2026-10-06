import { z } from 'zod';
import { currentSession } from '@/lib/auth/session';
import { assertOrigin, limiter, readJson } from '@/lib/server/security';
import { serverEnv } from '@/lib/server/env';
import { SiteError, errorResponse } from '@/lib/api/errors';
import { roomAction } from '@/lib/screen/rooms';
// Identity, nome e papel vêm sempre da sessão; o corpo só escolhe ação, sala e alvo.
const input = z
  .object({
    action: z.enum(['create', 'join', 'leave', 'lock', 'kick', 'share', 'silence', 'transfer', 'end']),
    code: z
      .string()
      .regex(/^[A-F0-9]{10}$/)
      .optional(),
    target: z
      .string()
      .regex(/^\d{17,20}$/)
      .optional(),
    enabled: z.boolean().optional(),
    capacity: z.number().int().min(2).max(50).optional(),
  })
  .strict();
export async function POST(request: Request) {
  try {
    assertOrigin(request.headers, serverEnv().AUTH_URL);
    if (request.headers.get('x-suburbio-intent') !== 'screen.room') throw new SiteError('INVALID_INPUT', 400);
    const session = await currentSession();
    if (!session) throw new SiteError('SESSION_REQUIRED', 401);
    const id = session.user.discordId;
    await limiter.consume('screen-room:' + id, 30);
    const parsed = input.safeParse(await readJson(request, 1024));
    if (!parsed.success) throw new SiteError('INVALID_INPUT', 400);
    // Criação de sala e emissão de token têm limites próprios além do geral.
    if (parsed.data.action === 'create') await limiter.consume('screen-room-create:' + id, 5, 10 * 60_000);
    if (parsed.data.action === 'join') await limiter.consume('screen-room-join:' + id, 20);
    return Response.json(await roomAction(session.user, parsed.data), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
