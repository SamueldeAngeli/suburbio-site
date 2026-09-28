export type AdminModule = { slug: string; title: string; capability: string; description: string; columns: string[]; filters: string[]; gap: string };
// Capability catalog resolved by Subúrbio API v0.3.
export const adminModules: AdminModule[] = [
  { slug: '', title: 'Visão geral', capability: 'DASHBOARD_READ', description: 'A cidade, vista de dentro.', columns: [], filters: [], gap: 'dashboard' },
  { slug: 'players', title: 'Jogadores', capability: 'PLAYERS_READ', description: 'Pessoas e histórias que fazem o Subúrbio acontecer.', columns: ['Jogador', 'Player ID', 'Discord', 'Status'], filters: ['Nome, playerId, Discord, license ou citizenid'], gap: 'players' },
  { slug: 'admins', title: 'Administradores', capability: 'ADMINS_READ', description: 'Identidade institucional, acesso e responsabilidade.', columns: ['AdminAccount', 'Discord', 'Status', 'Nível', 'Último acesso', 'Criado em'], filters: ['AdminAccount ou Discord'], gap: 'admins' },
  { slug: 'permissions', title: 'Permissões', capability: 'ADMIN_PERMISSIONS_MANAGE', description: 'Cada acesso com propósito. Cada alteração com registro.', columns: ['Capability', 'Grupo', 'Override', 'Validade'], filters: ['Capability ou grupo'], gap: 'permissions' },
  { slug: 'allowlist', title: 'Allowlist', capability: 'ALLOWLIST_READ', description: 'Acompanhe o acesso à cidade com segurança.', columns: ['Jogador', 'Discord', 'Status', 'Aprovação'], filters: ['Player ID'], gap: 'allowlist-list' },
  { slug: 'punishments', title: 'Punições', capability: 'PUNISHMENTS_READ', description: 'Histórico, motivos e acompanhamento.', columns: ['Jogador', 'Tipo', 'Motivo', 'Status', 'Data'], filters: ['Player ID ou Discord'], gap: 'punishments' },
  { slug: 'orders', title: 'Pedidos', capability: 'ORDERS_READ', description: 'Do pedido à entrega, cada etapa em um só lugar.', columns: ['Pedido', 'Cliente', 'Produto', 'Quantidade', 'Valor', 'Pagamento', 'Entrega', 'Data'], filters: ['Pedido, player, Discord ou produto'], gap: 'orders' },
  { slug: 'payments', title: 'Pagamentos', capability: 'PAYMENTS_READ', description: 'Acompanhe o financeiro com clareza.', columns: ['Pagamento', 'Provedor', 'Pedido', 'Cliente', 'Valor', 'Status', 'Criação', 'Aprovação', 'Reembolso', 'Chargeback'], filters: ['Pagamento, pedido ou cliente'], gap: 'payments' },
  { slug: 'refunds', title: 'Reembolsos', capability: 'REFUNDS_MANAGE', description: 'Tratamento responsável em cada solicitação.', columns: ['Reembolso', 'Pedido', 'Valor', 'Motivo', 'Status', 'Data'], filters: ['Pedido ou cliente'], gap: 'refunds' },
  { slug: 'chargebacks', title: 'Chargebacks', capability: 'CHARGEBACKS_READ', description: 'Contestações e seus próximos passos.', columns: ['Contestação', 'Pagamento', 'Valor', 'Status', 'Data'], filters: ['Pagamento ou cliente'], gap: 'chargebacks' },
  { slug: 'audit', title: 'Auditoria', capability: 'AUDIT_READ', description: 'Transparência sobre as ações administrativas.', columns: ['Executor', 'Ação', 'Alvo', 'Módulo', 'Data', 'Operação'], filters: ['Executor, ação, alvo, módulo ou operationId'], gap: 'audit' },
  { slug: 'discord', title: 'Discord', capability: 'DISCORD_READ', description: 'Acompanhe a conexão com a comunidade.', columns: ['Serviço', 'Estado', 'Última sincronização'], filters: [], gap: 'discord' },
  { slug: 'services', title: 'Serviços', capability: 'SERVICES_READ', description: 'Disponibilidade real, diretamente da Subúrbio API.', columns: [], filters: [], gap: '' },
  { slug: 'settings', title: 'Configurações', capability: 'SETTINGS_READ', description: 'Preferências institucionais e integrações.', columns: ['Configuração', 'Estado'], filters: [], gap: 'settings' },
  { slug: 'products', title: 'Produtos', capability: 'PRODUCTS_READ', description: 'Catálogo central de benefícios.', columns: [], filters: [], gap: '' },
  { slug: 'coupons', title: 'Cupons', capability: 'COUPONS_READ', description: 'Regras e desempenho de cupons.', columns: [], filters: [], gap: '' },
];
export const adminPath = (slug: string) => `/admin${slug ? `/${slug}` : ''}`;
