import 'server-only';
import type { AccountResolution } from '../contracts';
import { discordIdSchema } from '../contracts';
import { SiteError } from '../errors';
import { SuburbioApiClient } from '../client';

export interface AccountResolver { resolve(discordId: string): Promise<AccountResolution> }
export class AccountService implements AccountResolver {
  constructor(private client = new SuburbioApiClient()) {}
  async resolve(discordId: string): Promise<AccountResolution> {
    if (!discordIdSchema.safeParse(discordId).success) throw new SiteError('SESSION_REQUIRED', 401);
    const { data } = await this.client.resolveAdmin(discordId);
    if (data.discordId !== discordId) throw new SiteError('ADMIN_ACCESS_DENIED', 403);
    return { playerId: null, admin: {
      adminAccountId: data.adminAccountId, discordId: data.discordId, displayName: 'Administração',
      status: data.status, accessLevel: data.isSystemOwner ? 'SYSTEM_OWNER' : 'STANDARD',
      capabilities: data.capabilities, fullAccess: data.isSystemOwner, readOnly: data.readOnly,
    } };
  }
}
