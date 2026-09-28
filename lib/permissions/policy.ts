import type { AdminPrincipal } from '@/lib/api/contracts';
import { SiteError } from '@/lib/api/errors';
export function can(admin: AdminPrincipal | null, capability: string) {
  // fullAccess is an explicit API decision, never inferred from Discord/character/role.
  return admin?.status === 'active' && (admin.fullAccess === true || admin.capabilities.includes(capability));
}
export function assertCapability(admin: AdminPrincipal | null, capability: string): asserts admin is AdminPrincipal {
  if (!admin || admin.status !== 'active') throw new SiteError('ADMIN_ACCESS_DENIED', 403);
  if (!can(admin, capability)) throw new SiteError('ADMIN_CAPABILITY_REQUIRED', 403);
}
