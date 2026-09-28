import 'server-only';
import { cache } from 'react';
import { auth } from '@/auth';
import { serverEnv } from '@/lib/server/env';
import { discordIdSchema } from '@/lib/api/contracts';
export const currentSession = cache(async () => {
  if (!serverEnv().AUTH_ENABLED) return null;
  const session = await auth();
  return session && discordIdSchema.safeParse(session.user?.discordId).success ? session : null;
});
