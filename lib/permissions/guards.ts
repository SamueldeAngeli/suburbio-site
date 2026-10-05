import 'server-only';
import { cache } from 'react';
import { forbidden, redirect } from 'next/navigation';
import { currentSession } from '@/lib/auth/session';
import { AccountService, type AccountResolver } from '@/lib/api/modules/accounts';
import { SiteError } from '@/lib/api/errors';
import { assertCapability } from './policy';
import { limiter } from '@/lib/server/security';

export async function authorize(discordId: string | null, capability: string, resolver: AccountResolver) {
  if (!discordId) throw new SiteError('SESSION_REQUIRED', 401);
  const { admin } = await resolver.resolve(discordId);
  if (admin && admin.discordId !== discordId) throw new SiteError('ADMIN_ACCESS_DENIED', 403);
  if (!admin || admin.status !== 'active') throw new SiteError('ADMIN_ACCESS_DENIED', 403);
  if (capability) assertCapability(admin, capability);
  return admin;
}
const resolveForRequest = cache((discordId: string) => new AccountService().resolve(discordId));
export async function requireAdmin(capability: string) {
  const session = await currentSession();
  if (!session) throw new SiteError('SESSION_REQUIRED', 401);
  await limiter.consume(`admin:${session.user.discordId}`, 90);
  return authorize(
    session.user.discordId,
    capability,
    capability && !capability.endsWith('_READ') ? new AccountService(undefined, true) : { resolve: resolveForRequest },
  );
}
export async function pageAccess(capability: string, path: string) {
  try {
    return await requireAdmin(capability);
  } catch (error) {
    if (!(error instanceof SiteError)) throw error;
    if (error.status === 401) redirect(`/login?returnTo=${encodeURIComponent(path)}`);
    if (error.status === 403) forbidden();
    return null;
  }
}
