// PROPOSALS ONLY. No route below is invoked or considered available by the BFF.
import type { AccountResolution, AdminPrincipal, PageResult } from './contracts';
export interface ResolveAccountProposal {
  discordId: string;
}
export type ResolveAccountResponseProposal = AccountResolution;
export type AdminListProposal = PageResult<AdminPrincipal & { createdAt: string; lastAccessAt: string | null }>;
export interface CapabilityProposal {
  name: string;
  description: string;
  scope: string;
}
export interface PermissionOverrideProposal {
  adminAccountId: string;
  capability: string;
  allowed: boolean;
  expiresAt: string | null;
}
export interface PermissionChangeProposal extends PermissionOverrideProposal {
  actorDiscordId: string;
  reason: string;
}
export interface RefundProposal {
  refundId: string;
  orderId: string;
  paymentId: string;
  amountMinor: number;
  currency: string;
  status: string;
  reason: string;
  createdAt: string;
}
export interface ChargebackProposal {
  chargebackId: string;
  paymentId: string;
  orderId: string;
  amountMinor: number;
  currency: string;
  status: string;
  createdAt: string;
}
export interface PunishmentProposal {
  punishmentId: string;
  playerId: string;
  type: string;
  reason: string;
  status: string;
  createdAt: string;
  expiresAt: string | null;
}
export interface AllowlistListProposal {
  playerId: string;
  discordId: string | null;
  status: 'active' | 'revoked';
  approvedAt: string | null;
  updatedAt: string;
}
export interface DashboardProposal {
  players: number;
  activeAllowlists: number;
  ordersToday: number;
  revenueMinorToday: number;
  currency: string;
  pendingPayments: number;
  refunds: number;
  chargebacks: number;
  asOf: string;
  timeZone: string;
}
export interface DiscordStatusProposal {
  state: 'up' | 'down' | 'unmonitored';
  lastHeartbeatAt: string | null;
}
export interface SettingProposal {
  key: string;
  label: string;
  configured: boolean;
  secret: boolean;
  value?: string | number | boolean;
}
export interface ProductProposal {
  productId: string;
  name: string;
  category: string;
  amountMinor: number;
  currency: string;
  active: boolean;
  version: string;
  benefits: string[];
}
export interface OrderCreateProposal {
  actorDiscordId: string;
  items: { productId: string; quantity: number }[];
}
