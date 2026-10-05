import 'server-only';
import type { NextAuthConfig } from 'next-auth';
import { discordMembership } from './discord-membership';
import Discord from 'next-auth/providers/discord';
import { discordAvatar, safeAvatar } from '@/lib/public-profile';
import { serverEnv, type ServerEnv } from '@/lib/server/env';
import { discordIdSchema } from '@/lib/api/contracts';

export function createAuthConfig(env: ServerEnv = serverEnv()): NextAuthConfig {
  return {
    secret: env.AUTH_SECRET
      ? [env.AUTH_SECRET, ...(env.AUTH_SECRET_PREVIOUS ? [env.AUTH_SECRET_PREVIOUS] : [])]
      : undefined,
    // AUTH_URL is required/validated when enabled; Auth.js replaces untrusted request origin with it.
    trustHost: true,
    useSecureCookies: env.NODE_ENV === 'production' || env.AUTH_URL?.startsWith('https://'),
    session: { strategy: 'jwt', maxAge: 3600 },
    pages: { signIn: '/login', error: '/login' },
    providers: env.AUTH_ENABLED
      ? [
          Discord({
            clientId: env.DISCORD_CLIENT_ID!,
            clientSecret: env.DISCORD_CLIENT_SECRET!,
            authorization: { params: { scope: 'identify guilds.members.read' } },
            // Discord's documented confidential web flow supports state; PKCE is not documented there.
            checks: ['state'],
            profile(profile) {
              return {
                id: discordIdSchema.parse(profile.id),
                name: String(profile.global_name ?? profile.username).slice(0, 100),
                image: discordAvatar(profile.id, profile.avatar),
              };
            },
          }),
        ]
      : [],
    callbacks: {
      async signIn({ account, profile }) {
        return account?.provider === 'discord' && discordIdSchema.safeParse(profile?.id).success;
      },
      async jwt({ token, account, profile }) {
        if (account?.provider === 'discord' && profile) {
          token.discordId = discordIdSchema.parse(profile.id);
          token.authenticatedAt = Date.now();
          token.picture = discordAvatar(profile.id, profile.avatar);
          token.username = typeof profile.username === 'string' ? profile.username.slice(0, 100) : null;
          if (account.access_token)
            discordMembership.remember(
              String(token.discordId),
              account.access_token,
              (account.expires_at ?? Date.now() / 1000 + 3600) * 1000,
            );
        }
        // Never accept identity/capability updates supplied by useSession().update().
        if (
          !discordIdSchema.safeParse(token.discordId).success ||
          typeof token.authenticatedAt !== 'number' ||
          Date.now() - token.authenticatedAt > 8 * 3600_000
        )
          return null;
        return token;
      },
      async session({ session, token }) {
        return {
          expires: session.expires,
          user: {
            name: session.user?.name ?? 'Cidadão',
            discordId: String(token.discordId),
            ...(safeAvatar(token.picture) ? { image: safeAvatar(token.picture) } : {}),
            ...(typeof token.username === 'string' ? { username: token.username } : {}),
          },
        };
      },
      async redirect({ url }) {
        const base = env.AUTH_URL!;
        try {
          const target = new URL(url, base);
          return target.origin === new URL(base).origin ? target.href : `${new URL(base).origin}/minha-conta`;
        } catch {
          return `${new URL(base).origin}/minha-conta`;
        }
      },
    },
    events: {
      async signOut(message) {
        if ('token' in message && typeof message.token?.discordId === 'string')
          discordMembership.forget(message.token.discordId);
      },
    },
    logger: {
      error() {
        console.error(JSON.stringify({ module: 'auth', result: 'failed' }));
      },
      warn() {},
      debug() {},
    },
  };
}
