import { z } from 'zod';
import { currentSession } from '@/lib/auth/session';
import { assertOrigin, limiter, readJson } from '@/lib/server/security';
import { serverEnv } from '@/lib/server/env';
import { SiteError, errorResponse } from '@/lib/api/errors';
import { AccountService } from '@/lib/api/modules/accounts';
import { authorize } from '@/lib/permissions/guards';
import { CATEGORIES, listBroadcasts, roomAction, SCREEN_MODERATION_CAPABILITY } from '@/lib/screen/rooms';
// Identity, nome e papel vêm sempre da sessão; o corpo só escolhe ação, sala, alvo e os textos da transmissão.
const input = z
  .object({
    action: z.enum(['create', 'join', 'leave', 'live', 'lock', 'kick', 'share', 'silence', 'transfer', 'end']),
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
    title: z.string().trim().min(3).max(80).optional(),
    description: z.string().trim().max(280).optional(),
    category: z.enum(CATEGORIES).optional(),
    visibility: z.enum(['public', 'private']).optional(),
    invite: z
      .string()
      .regex(/^[a-f0-9]{32}$/)
      .optional(),
    reason: z.string().trim().min(3).max(200).optional(),
  })
  .strict()
  .refine((v) => v.action !== 'create' || !!v.title, { path: ['title'] });
const noStore = { 'Cache-Control': 'private, no-store' };

export async function GET() {
  try {
    const session = await currentSession();
    if (!session) throw new SiteError('SESSION_REQUIRED', 401);
    // A central atualiza a cada ~15s; o limite cobre várias abas sem permitir varredura agressiva.
    await limiter.consume('screen-list:' + session.user.discordId, 30);
    return Response.json(await listBroadcasts(session.user), { headers: noStore });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertOrigin(request.headers, serverEnv().AUTH_URL);
    if (request.headers.get('x-suburbio-intent') !== 'screen.room') throw new SiteError('INVALID_INPUT', 400);
    const session = await currentSession();
    if (!session) throw new SiteError('SESSION_REQUIRED', 401);
    const id = session.user.discordId;
    await limiter.consume('screen-room:' + id, 30);
    const parsed = input.safeParse(await readJson(request, 2048));
    if (!parsed.success) throw new SiteError('INVALID_INPUT', 400);
    // Criação de sala e emissão de token têm limites próprios além do geral.
    if (parsed.data.action === 'create') await limiter.consume('screen-room-create:' + id, 5, 10 * 60_000);
    if (parsed.data.action === 'join') await limiter.consume('screen-room-join:' + id, 20);
    const isStaff = () =>
      authorize(id, SCREEN_MODERATION_CAPABILITY, new AccountService(undefined, true)).then(
        () => true,
        () => false,
      );
    return Response.json(await roomAction(session.user, parsed.data, undefined, { isStaff }), {
      headers: noStore,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
