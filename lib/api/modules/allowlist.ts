import 'server-only';
import { SuburbioApiClient } from '../client';
import { revokeInputSchema, type AdminPrincipal } from '../contracts';
import { assertCapability } from '@/lib/permissions/policy';
import { SiteError } from '../errors';
export class AllowlistService {
  constructor(private api = new SuburbioApiClient()) {}
  get(playerId: string) {
    return this.api.allowlist(playerId);
  }
  revoke(input: unknown, admin: AdminPrincipal) {
    assertCapability(admin, 'ALLOWLIST_REVOKE');
    if (admin.readOnly) throw new SiteError('API_READ_ONLY');
    const parsed = revokeInputSchema.safeParse(input);
    if (!parsed.success) throw new SiteError('INVALID_INPUT', 400);
    return this.api.revoke(parsed.data.playerId, parsed.data.reason, admin.discordId, parsed.data.idempotencyKey);
  }
}
