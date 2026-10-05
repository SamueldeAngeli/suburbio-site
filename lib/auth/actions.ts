'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { signIn, signOut } from '@/auth';
import { serverEnv } from '@/lib/server/env';
import { assertOrigin, limiter, safeReturnTo } from '@/lib/server/security';
import { SiteError } from '@/lib/api/errors';

export async function loginDiscord(data: FormData) {
  const env = serverEnv();
  if (!env.AUTH_ENABLED) redirect('/login?error=not-configured');
  try {
    assertOrigin(await headers(), env.AUTH_URL);
    await limiter.consume('oauth-start', 30);
    await signIn('discord', { redirectTo: safeReturnTo(data.get('returnTo')) });
  } catch (error) {
    if (error instanceof AuthError || error instanceof SiteError) redirect('/login?error=unavailable');
    throw error; // Preserve Next.js redirect interrupts.
  }
}
export async function logout() {
  const env = serverEnv();
  assertOrigin(await headers(), env.AUTH_URL);
  if (env.AUTH_ENABLED) await signOut({ redirectTo: '/' });
  redirect('/');
}
