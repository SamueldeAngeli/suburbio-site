import type { AdminListKind } from '@/lib/api/client';

// Colunas das listas somente leitura do Admin. O formato orienta só a exibição (dinheiro, data, estado);
// os dados e a autorização vêm da API.
export type ColumnFormat = 'text' | 'id' | 'money' | 'date' | 'status' | 'discord';
export type Column = { key: string; label: string; format?: ColumnFormat; currencyKey?: string };
export type AdminListConfig = {
  kind: AdminListKind;
  columns: Column[];
  // Lista sem busca/filtro de data no servidor (os filtros seriam ignorados).
  filters: boolean;
  searchHint?: string;
  statusHint?: string;
  empty: string;
};

export const adminLists: Record<string, AdminListConfig> = {
  orders: {
    kind: 'orders',
    filters: true,
    searchHint: 'ID do pedido, Discord, referência ou produto',
    statusHint: 'pending, approved, delivered…',
    empty: 'Nenhum pedido encontrado.',
    columns: [
      { key: 'id', label: 'Pedido', format: 'id' },
      { key: 'customerDiscordId', label: 'Cliente', format: 'discord' },
      { key: 'items', label: 'Itens' },
      { key: 'amountMinor', label: 'Valor', format: 'money', currencyKey: 'currency' },
      { key: 'paymentStatus', label: 'Pagamento', format: 'status' },
      { key: 'deliveryStatus', label: 'Entrega', format: 'status' },
      { key: 'createdAt', label: 'Data', format: 'date' },
    ],
  },
  payments: {
    kind: 'payments',
    filters: true,
    searchHint: 'ID do pagamento, do pedido ou referência do provedor',
    statusHint: 'approved, pending, failed…',
    empty: 'Nenhum pagamento registrado.',
    columns: [
      { key: 'id', label: 'Pagamento', format: 'id' },
      { key: 'orderId', label: 'Pedido', format: 'id' },
      { key: 'provider', label: 'Provedor' },
      { key: 'providerReference', label: 'Referência' },
      { key: 'amountMinor', label: 'Valor', format: 'money', currencyKey: 'currency' },
      { key: 'status', label: 'Status', format: 'status' },
      { key: 'providerStatus', label: 'No provedor', format: 'status' },
      { key: 'paidAt', label: 'Pago em', format: 'date' },
    ],
  },
  refunds: {
    kind: 'refunds',
    filters: true,
    searchHint: 'ID do reembolso, pagamento ou pedido; ou texto do motivo',
    statusHint: 'pending, processed, failed…',
    empty: 'Nenhum reembolso registrado.',
    columns: [
      { key: 'id', label: 'Reembolso', format: 'id' },
      { key: 'orderId', label: 'Pedido', format: 'id' },
      { key: 'amountMinor', label: 'Valor', format: 'money', currencyKey: 'currency' },
      { key: 'reason', label: 'Motivo' },
      { key: 'status', label: 'Status', format: 'status' },
      { key: 'processedAt', label: 'Processado em', format: 'date' },
      { key: 'createdAt', label: 'Data', format: 'date' },
    ],
  },
  chargebacks: {
    kind: 'chargebacks',
    filters: true,
    searchHint: 'ID da contestação, pagamento ou pedido',
    statusHint: 'open, won, lost, closed',
    empty: 'Nenhuma contestação registrada.',
    columns: [
      { key: 'id', label: 'Contestação', format: 'id' },
      { key: 'orderId', label: 'Pedido', format: 'id' },
      { key: 'amountMinor', label: 'Valor', format: 'money', currencyKey: 'currency' },
      { key: 'status', label: 'Status', format: 'status' },
      { key: 'resolvedAt', label: 'Resolvida em', format: 'date' },
      { key: 'createdAt', label: 'Data', format: 'date' },
    ],
  },
  audit: {
    kind: 'audit',
    filters: true,
    searchHint: 'Ação, alvo, Discord do executor ou operationId',
    empty: 'Nenhuma ação administrativa registrada.',
    columns: [
      { key: 'createdAt', label: 'Data', format: 'date' },
      { key: 'actorDiscordId', label: 'Executor', format: 'discord' },
      { key: 'service', label: 'Serviço' },
      { key: 'action', label: 'Ação' },
      { key: 'targetType', label: 'Alvo' },
      { key: 'targetId', label: 'ID do alvo', format: 'id' },
      { key: 'reason', label: 'Motivo' },
      { key: 'operationId', label: 'Operação', format: 'id' },
    ],
  },
  punishments: {
    kind: 'punishments',
    filters: false,
    empty: 'Nenhum banimento na cidade.',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Nome' },
      { key: 'license', label: 'License', format: 'id' },
      { key: 'discord', label: 'Discord' },
      { key: 'reason', label: 'Motivo' },
      { key: 'expire', label: 'Expira (valor da base)' },
      { key: 'bannedBy', label: 'Aplicado por' },
    ],
  },
  permissions: {
    kind: 'permissions',
    filters: true,
    searchHint: 'Discord do administrador ou capability',
    statusHint: 'active, disabled',
    empty: 'Nenhuma conta administrativa.',
    columns: [
      { key: 'discordId', label: 'Administrador', format: 'discord' },
      { key: 'level', label: 'Nível' },
      { key: 'status', label: 'Status', format: 'status' },
      { key: 'capabilities', label: 'Permissões (− = negada)' },
      { key: 'updatedAt', label: 'Atualizado em', format: 'date' },
    ],
  },
  allowlist: {
    kind: 'allowlist',
    filters: true,
    searchHint: 'Discord, license ou Player ID',
    statusHint: 'active, revoked',
    empty: 'Nenhuma allowlist encontrada.',
    columns: [
      { key: 'discordId', label: 'Discord', format: 'discord' },
      { key: 'playerId', label: 'Player ID', format: 'id' },
      { key: 'license', label: 'License', format: 'id' },
      { key: 'status', label: 'Status', format: 'status' },
      { key: 'approvedAt', label: 'Aprovada em', format: 'date' },
      { key: 'revokedAt', label: 'Revogada em', format: 'date' },
      { key: 'revocationCode', label: 'Motivo da revogação' },
    ],
  },
  discord: {
    kind: 'discord-sync',
    filters: false,
    empty: 'Sem dados de sincronização.',
    columns: [
      { key: 'name', label: 'Sincronização' },
      { key: 'count', label: 'Quantidade' },
      { key: 'at', label: 'Última atualização', format: 'date' },
    ],
  },
};

const STATUS: Record<string, string> = {
  pending: 'Pendente',
  processing: 'Processando',
  approved: 'Aprovado',
  rejected: 'Recusado',
  cancelled: 'Cancelado',
  expired: 'Expirado',
  review: 'Em revisão',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  delivered: 'Entregue',
  failed: 'Falhou',
  processed: 'Processado',
  refunded: 'Reembolsado',
  charged_back: 'Contestado',
  in_process: 'Em análise',
  authorized: 'Autorizado',
  open: 'Aberta',
  won: 'Ganha',
  lost: 'Perdida',
  closed: 'Encerrada',
  active: 'Ativo',
  revoked: 'Revogada',
  disabled: 'Desativado',
};

export function formatCell(row: Record<string, unknown>, column: Column): string {
  const value = row[column.key];
  if (value === null || value === undefined || value === '') return '—';
  switch (column.format) {
    case 'money': {
      const minor = Number(value);
      const currency = String(row[column.currencyKey ?? 'currency'] ?? 'BRL');
      if (!Number.isFinite(minor)) return String(value);
      return currency === 'BRL'
        ? (minor / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : `${minor.toLocaleString('pt-BR')} ${currency}`;
    }
    case 'date': {
      const date = new Date(String(value));
      return Number.isNaN(date.getTime())
        ? String(value)
        : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
    }
    case 'status':
      return STATUS[String(value)] ?? String(value);
    case 'id':
      return String(value).length > 13 ? `${String(value).slice(0, 8)}…` : String(value);
    default:
      return String(value);
  }
}
