import { randomUUID } from 'node:crypto';

const messages: Record<string, string> = {
  WAITING_FOR_FIVEM_BASE: 'Slots ainda indisponíveis. Aguarde a integração com a cidade.',
  ROOM_UNAVAILABLE: 'Transmissão indisponível. Tente novamente em instantes.',
  ROOM_NOT_FOUND: 'Sala ou participante não encontrado.',
  ROOM_LOCKED: 'Esta sala está fechada para novas entradas.',
  ROOM_HOST_REQUIRED: 'Somente o anfitrião pode realizar esta ação.',
  ROOM_FULL: 'Esta sala está cheia.',
  GIFT_RECIPIENT_NOT_FOUND: 'Destinatário não encontrado. Confira o Discord informado.',
  GIFT_SELF: 'Selecione Para mim para adquirir este benefício.',
  GIFT_CONFIRMATION_EXPIRED: 'Busque e confirme o destinatário novamente.',
  GIFT_UNAVAILABLE: 'Presentes temporariamente indisponíveis.',
  GIFT_TYPE_UNAVAILABLE: 'Um benefício do carrinho ainda não está disponível para presente.',
  AFFILIATE_NOT_FOUND: 'Área de afiliado indisponível para esta conta.',
  AFFILIATE_INACTIVE: 'Afiliado inativo. Revise o cadastro antes do repasse.',
  AFFILIATE_CONFLICT: 'Esta conta já possui um cadastro de afiliado.',
  AFFILIATE_IDENTITY_IMMUTABLE: 'A conta do afiliado não pode ser substituída.',
  AFFILIATE_COUPON_MANAGED: 'Edite este cupom no cadastro do afiliado.',
  AFFILIATE_PAYOUT_CONFLICT: 'O saldo mudou. Recarregue e confira o valor antes de confirmar.',
  PAYMENT_DISABLED: 'Pagamento temporariamente indisponível.',
  PAYMENT_PROVIDER_UNAVAILABLE: 'O provedor não respondeu. Seu pedido foi preservado; tente consultar novamente.',
  CHECKOUT_RECONCILIATION_REQUIRED: 'Pagamento em preparação. Aguarde alguns instantes e tente novamente.',
  ORDER_NOT_PAYABLE: 'Este pedido não está disponível para pagamento. Consulte o status atualizado.',
  DISCORD_UNAVAILABLE: 'Não foi possível verificar seu acesso agora. Entre novamente ou tente em instantes.',
  ORDER_NOT_FOUND: 'Pedido não encontrado para esta conta.',
  ORDER_CANNOT_CANCEL: 'Este pedido requer análise do pagamento antes de ser cancelado.',
  PLAYER_LINK_REQUIRED: 'Vincule seu Discord à cidade antes de criar um pedido.',
  CHARACTER_NOT_OWNED: 'O personagem selecionado não pertence à sua conta.',
  ORDER_LIMIT_REACHED: 'Conclua ou cancele seus pedidos pendentes antes de continuar.',
  ORDER_AMOUNT_INVALID: 'O valor final do pedido deve ser maior que zero.',
  COUPON_NOT_FOUND: 'Cupom não encontrado.',
  COUPON_NOT_ELIGIBLE: 'Este cupom não está disponível para os itens ou condições do seu pedido.',
  COUPON_CODE_CONFLICT: 'Este código de cupom já está em uso.',
  STOCK_UNAVAILABLE: 'A quantidade escolhida não está disponível em estoque.',
  PRODUCT_UNAVAILABLE: 'Um benefício do carrinho está indisponível.',
  CRYPTO_QUANTITY_INVALID: 'Quantidade de Crypto fora dos limites permitidos.',
  CRYPTO_PACKAGE_INVALID: 'Pacote de Crypto inválido.',
  REVISION_CONFLICT: 'Este registro foi alterado. Recarregue a página antes de salvar.',
  SLUG_CONFLICT: 'Este identificador já está em uso.',
  CATEGORY_NOT_ACTIVE: 'Selecione uma categoria ativa.',
  PRODUCT_NOT_FOUND: 'Produto não encontrado.',
  ADMIN_NOT_FOUND: 'Administrador não encontrado.',
  API_GAP: 'Informações ainda indisponíveis.',
  API_NOT_CONFIGURED: 'Este serviço estará disponível em breve.',
  API_OFFLINE: 'Serviço temporariamente indisponível.',
  API_READ_ONLY: 'Alterações temporariamente indisponíveis. Nenhuma alteração foi realizada.',
  API_INVALID_RESPONSE: 'Não foi possível concluir a solicitação. Tente novamente em instantes.',
  ADMIN_ACCESS_DENIED: 'Acesso administrativo não autorizado.',
  ADMIN_CAPABILITY_REQUIRED: 'Você não tem permissão para esta ação.',
  SESSION_REQUIRED: 'Entre com sua conta Discord para continuar.',
  INVALID_INPUT: 'Confira os campos informados.',
  INVALID_ORIGIN: 'Origem da solicitação não autorizada.',
  RATE_LIMITED: 'Muitas solicitações. Aguarde um minuto e tente novamente.',
  ALLOWLIST_NOT_FOUND: 'Allowlist não encontrada.',
  IDEMPOTENCY_CONFLICT: 'Esta solicitação já foi utilizada com outros dados.',
};
export type Trace = { requestId?: string; correlationId?: string; operationId?: string };
export class SiteError extends Error {
  readonly reference: string;
  constructor(
    public code: string,
    public status = 503,
    public trace: Trace = {},
  ) {
    super(messages[code] ?? 'Não foi possível concluir a solicitação.');
    this.reference = `OP-${randomUUID().slice(0, 8).toUpperCase()}`;
  }
}
export function safeError(error: unknown) {
  const e = error instanceof SiteError ? error : new SiteError('INTERNAL_ERROR', 500);
  return {
    status: e.status,
    body: { success: false as const, error: { code: e.code, message: e.message, reference: e.reference }, ...e.trace },
  };
}
export function errorResponse(error: unknown) {
  const e = safeError(error);
  return Response.json(e.body, {
    status: e.status,
    headers: { 'Cache-Control': 'private, no-store', ...(e.status === 429 ? { 'Retry-After': '60' } : {}) },
  });
}
