// View models for future adapters, not official API contracts or routes.
export type RecipientView = { name: string; discord: string; passport?: string };
export type RenewalView = {
  entitlementId: string;
  assetInstanceId: string;
  options: { id: string; days: number; amountMinor: number; currency: 'BRL' }[];
};
export type SlotsView = {
  effectiveCharacterSlots: number;
  maximum: number;
  purchaseAllowed: boolean;
  availableQuantity: number;
};
export type VipQueueView = {
  current: { name: string; remaining: string } | null;
  next: { id: string; name: string; duration: string }[];
};
export type RefundView = { status: 'initiated' | 'processing' | 'refunded' | 'review'; reason?: 'slot_limit' };
export const refundLabels = {
  initiated: 'Estorno iniciado',
  processing: 'Estorno processando',
  refunded: 'Estornado',
  review: 'Falha no estorno / revisão',
};
export function benefitGroup(type: string) {
  return type === 'VIP' ? 'vip' : type === 'VEHICLE' ? 'veiculos' : type === 'PROPERTY' ? 'imoveis' : 'outros';
}
