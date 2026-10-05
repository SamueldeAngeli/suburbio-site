export const entitlementStatus = {
  PENDING: 'Aguardando ativação',
  ACTIVE: 'Ativo',
  EXPIRED: 'Expirado',
  REVOKED: 'Revogado',
};
export function remainingLabel(status: keyof typeof entitlementStatus, expiresAt: string | null, asOf: string) {
  if (status === 'PENDING') return 'Começa após a ativação';
  if (status === 'EXPIRED') return 'Prazo encerrado';
  if (status === 'REVOKED') return 'Benefício revogado';
  if (!expiresAt) return 'Permanente';
  const ms = Date.parse(expiresAt) - Date.parse(asOf);
  if (ms <= 0) return 'Prazo encerrado';
  const days = Math.ceil(ms / 86400000);
  return days === 1 ? 'Expira em até 1 dia' : `Expira em ${days} dias`;
}
