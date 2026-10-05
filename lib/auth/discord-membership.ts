import 'server-only';
import { z } from 'zod';
import { serverEnv } from '@/lib/server/env';
export type Membership = {
  guildId: string;
  status: 'VERIFIED' | 'NO_MEMBER' | 'UNAVAILABLE';
  verifiedRoleIds: string[];
  verifiedAt: string;
};
type Entry = { accessToken: string; expiresAt: number; cached?: Membership };
export class DiscordMembership {
  private entries = new Map<string, Entry>();
  constructor(
    private transport: typeof fetch = fetch,
    private now = () => Date.now(),
  ) {}
  remember(id: string, accessToken: string, expiresAt: number) {
    for (const [key, value] of this.entries) if (value.expiresAt <= this.now()) this.entries.delete(key);
    if (this.entries.size >= 10000 && !this.entries.has(id)) this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(id, { accessToken, expiresAt: Math.min(expiresAt, this.now() + 8 * 3600_000) });
  }
  forget(id: string) {
    this.entries.delete(id);
  }
  async get(id: string, guildId: string, ttlSeconds: number, force = false): Promise<Membership> {
    const unknown = (): Membership => ({
      guildId,
      status: 'UNAVAILABLE',
      verifiedRoleIds: [],
      verifiedAt: new Date(this.now()).toISOString(),
    });
    const entry = this.entries.get(id);
    if (!entry || entry.expiresAt <= this.now()) {
      this.forget(id);
      return unknown();
    }
    if (
      !force &&
      entry.cached?.guildId === guildId &&
      this.now() - Date.parse(entry.cached.verifiedAt) < ttlSeconds * 1000
    )
      return entry.cached;
    if (!/^\d{17,20}$/.test(id) || !/^\d{17,20}$/.test(guildId)) return unknown();
    try {
      const response = await this.transport(`https://discord.com/api/v10/users/@me/guilds/${guildId}/member`, {
        headers: { Authorization: `Bearer ${entry.accessToken}` },
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
      });
      let result: Membership;
      if (response.status === 404) result = { ...unknown(), status: 'NO_MEMBER' };
      else if (!response.ok) result = unknown();
      else {
        const body = z
          .object({ user: z.object({ id: z.string() }), roles: z.array(z.string()).max(250) })
          .safeParse(await response.json());
        if (!body.success || body.data.user.id !== id) {
          entry.cached = undefined;
          return unknown();
        }
        result = {
          ...unknown(),
          status: 'VERIFIED',
          verifiedRoleIds: [...new Set(body.data.roles.filter((r) => /^\d{17,20}$/.test(r)))],
        };
      }
      // A response from an older login cannot replace a newer session's membership.
      if (this.entries.get(id) !== entry) return unknown();
      entry.cached = result.status === 'UNAVAILABLE' ? undefined : result;
      return result;
    } catch {
      entry.cached = undefined;
      return unknown();
    }
  }
}
// Shared only within this server process. Tokens are never persisted in JWT/HTML/session.
const shared = globalThis as typeof globalThis & { suburbioDiscordMembership?: DiscordMembership };
export const discordMembership = (shared.suburbioDiscordMembership ??= new DiscordMembership());
export const currentMembership = (id: string, force = false) => {
  const env = serverEnv();
  return discordMembership.get(id, env.DISCORD_GUILD_ID, env.DISCORD_ROLE_REFRESH_SECONDS, force);
};
