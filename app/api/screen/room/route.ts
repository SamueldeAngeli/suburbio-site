import { z } from 'zod';
import { currentSession } from '@/lib/auth/session';
import { assertOrigin, limiter, readJson } from '@/lib/server/security';
import { serverEnv } from '@/lib/server/env';
import { SiteError, errorResponse } from '@/lib/api/errors';
import { roomAction } from '@/lib/screen/rooms';
const input = z
  .object({
    action: z.enum(['create', 'join', 'lock', 'kick', 'share', 'transfer', 'end', 'leave']),
    code: z
      .string()
      .regex(/^[A-F0-9]{10}$/)
      .optional(),
    target: z
      .string()
      .regex(/^\d{17,20}$/)
      .optional(),
    enabled: z.boolean().optional(),
  })
  .strict();
export async function POST(request: Request) {
  try {
    assertOrigin(request.headers, serverEnv().AUTH_URL);
    if (request.headers.get('x-suburbio-intent') !== 'screen.room') throw new SiteError('INVALID_INPUT', 400);
    const session = await currentSession();
    if (!session) throw new SiteError('SESSION_REQUIRED', 401);
    await limiter.consume('screen-room:' + session.user.discordId, 30);
    const parsed = input.safeParse(await readJson(request));
    if (!parsed.success) throw new SiteError('INVALID_INPUT', 400);
    return Response.json(await roomAction(session.user, parsed.data), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
