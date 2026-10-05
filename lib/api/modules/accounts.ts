import 'server-only';
import { serverEnv } from '@/lib/server/env';
import { currentMembership } from '@/lib/auth/discord-membership';
import type { AccountResolution } from '../contracts';
import { discordIdSchema } from '../contracts';
import { SiteError } from '../errors';
import { SuburbioApiClient } from '../client';

export interface AccountResolver {
  resolve(discordId: string): Promise<AccountResolution>;
}
export class AccountService implements AccountResolver {
  constructor(
    private client = new SuburbioApiClient(),
    private forceRefresh = false,
  ) {}
  async resolve(discordId: string): Promise<AccountResolution> {
    if (!discordIdSchema.safeParse(discordId).success) throw new SiteError('SESSION_REQUIRED', 401);
    let data;
    if (serverEnv().DISCORD_ROLE_AUTH_ENABLED) {
      try {
        data = (await this.client.resolveAdmin(discordId)).data;
      } catch (error) {
        if (!(error instanceof SiteError) || error.status !== 403) throw error;
      }
      // Only the API's institutional owner decision bypasses Discord availability.
      if (!data?.isSystemOwner) {
        const membership = await currentMembership(discordId, this.forceRefresh);
        if (membership.status === 'UNAVAILABLE') {
          try {
            await this.client.resolveAdmin(discordId, membership);
          } catch {}
          throw new SiteError('DISCORD_UNAVAILABLE', 503);
        }
        data = (await this.client.resolveAdmin(discordId, membership)).data;
      }
    } else data = (await this.client.resolveAdmin(discordId)).data;
    if (data.discordId !== discordId) throw new SiteError('ADMIN_ACCESS_DENIED', 403);
    return {
      playerId: null,
      admin: {
        adminAccountId: data.adminAccountId,
        discordId: data.discordId,
        displayName: 'Administração',
        status: data.status,
        accessLevel: data.isSystemOwner ? 'SYSTEM_OWNER' : 'STANDARD',
        capabilities: data.capabilities,
        fullAccess: data.isSystemOwner,
        readOnly: data.readOnly,
      },
    };
  }
}
