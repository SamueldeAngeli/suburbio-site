// Capabilities da API em português, agrupadas por área ("Jogadores: ver, gerenciar").
// Só exibição: a autorização continua sendo o código, decidido pela API.
const AREA: [prefix: string, label: string][] = [
  ['ADMIN_PERMISSIONS', 'Permissões de admins'],
  ['AFFILIATES_PAYOUT', 'Repasses de afiliados'],
  ['TICKETS_TRANSCRIPT', 'Transcrição de tickets'],
  ['DASHBOARD', 'Visão geral'],
  ['PLAYERS', 'Jogadores'],
  ['ADMINS', 'Administradores'],
  ['PERMISSIONS', 'Permissões'],
  ['ALLOWLIST', 'Allowlist'],
  ['PUNISHMENTS', 'Punições'],
  ['TICKETS', 'Tickets'],
  ['ORDERS', 'Pedidos'],
  ['PAYMENTS', 'Pagamentos'],
  ['REFUNDS', 'Reembolsos'],
  ['CHARGEBACKS', 'Chargebacks'],
  ['PRODUCTS', 'Produtos'],
  ['COUPONS', 'Cupons'],
  ['AFFILIATES', 'Afiliados'],
  ['AUDIT', 'Auditoria'],
  ['SERVICES', 'Serviços'],
  ['DISCORD', 'Discord'],
  ['SETTINGS', 'Configurações'],
];
const ACTION: Record<string, string> = {
  READ: 'ver',
  MANAGE: 'gerenciar',
  WRITE: 'aplicar',
  CREATE: 'criar',
  UPDATE: 'editar',
  DISABLE: 'desativar',
  REVOKE: 'revogar',
  INTERNAL: 'ver interna',
};

export const TOTAL_CAPABILITIES = 37;

export function capabilityGroups(capabilities: string[]) {
  const groups = new Map<string, string[]>();
  for (const code of capabilities) {
    const area = AREA.find(([prefix]) => code.startsWith(prefix + '_'));
    const label = area ? area[1] : code;
    const action = area ? (ACTION[code.slice(area[0].length + 1)] ?? code.slice(area[0].length + 1).toLowerCase()) : '';
    groups.set(label, [...(groups.get(label) ?? []), ...(action ? [action] : [])]);
  }
  return [...groups].map(([area, actions]) => ({ area, actions }));
}
