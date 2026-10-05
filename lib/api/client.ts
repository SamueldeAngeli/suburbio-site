import { giftInput, recipientSchema, giftHistorySchema } from './gift-contracts';
import {
  affiliateSchema,
  affiliateMutation,
  dashboardSchema,
  payoutInput,
  payoutSchema,
  affiliateCode,
  periodSchema,
} from './affiliate-contracts';
import { balanceSchema, charactersSchema } from './citizen-contracts';
import 'server-only';
import type { Membership } from '@/lib/auth/discord-membership';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { serverEnv, type ServerEnv } from '@/lib/server/env';
import { SiteError, type Trace } from './errors';
import { signedHeaders } from './hmac';
import { logEvent } from '@/lib/server/log';
import { orderListSchema, orderDetailSchema, orderSummarySchema } from './order-contracts';
import { entitlementsPage } from './entitlement-contracts';
import { cryptoInput, cryptoConfigSchema, cryptoQuoteSchema, cartInput, cartQuoteSchema } from './cart-contracts';
import { couponInput, couponSchema, couponMetricsSchema, type CouponInput } from './coupon-contracts';
import {
  productSchema,
  categorySchema,
  productInput,
  categoryInput,
  catalogSchema,
  type ProductInput,
  type CategoryInput,
} from './catalog-contracts';
import {
  healthSchema,
  internalHealthSchema,
  allowlistSchema,
  revokeResultSchema,
  operationSchema,
  uuid,
  discordIdSchema,
  adminResolutionSchema,
  adminListSchema,
  adminSummarySchema,
} from './contracts';

export type ApiResult<T> = { data: T; trace: Trace };
const safeId = (v: unknown) => (typeof v === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(v) ? v : undefined);
const knownErrors = new Set([
  'WAITING_FOR_FIVEM_BASE',
  'GIFT_RECIPIENT_NOT_FOUND',
  'GIFT_SELF',
  'GIFT_CONFIRMATION_EXPIRED',
  'GIFT_UNAVAILABLE',
  'GIFT_TYPE_UNAVAILABLE',
  'AFFILIATE_NOT_FOUND',
  'AFFILIATE_INACTIVE',
  'AFFILIATE_CONFLICT',
  'AFFILIATE_IDENTITY_IMMUTABLE',
  'AFFILIATE_COUPON_MANAGED',
  'AFFILIATE_PAYOUT_CONFLICT',
  'PAYMENT_DISABLED',
  'PAYMENT_PROVIDER_UNAVAILABLE',
  'CHECKOUT_RECONCILIATION_REQUIRED',
  'ORDER_NOT_PAYABLE',
  'ORDER_NOT_FOUND',
  'ORDER_CANNOT_CANCEL',
  'PLAYER_LINK_REQUIRED',
  'CHARACTER_NOT_OWNED',
  'ORDER_LIMIT_REACHED',
  'ORDER_AMOUNT_INVALID',
  'API_READ_ONLY',
  'ADMIN_ACCESS_DENIED',
  'ADMIN_CAPABILITY_REQUIRED',
  'ALLOWLIST_NOT_FOUND',
  'IDEMPOTENCY_CONFLICT',
  'REVISION_CONFLICT',
  'SLUG_CONFLICT',
  'CATEGORY_NOT_ACTIVE',
  'PRODUCT_NOT_FOUND',
  'ADMIN_NOT_FOUND',
  'COUPON_NOT_FOUND',
  'COUPON_NOT_ELIGIBLE',
  'COUPON_CODE_CONFLICT',
  'STOCK_UNAVAILABLE',
  'PRODUCT_UNAVAILABLE',
  'CRYPTO_QUANTITY_INVALID',
  'CRYPTO_PACKAGE_INVALID',
]);
export type Failure =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_hmac'
  | 'api_timeout'
  | 'api_unavailable'
  | 'malformed_response'
  | 'internal_api_error'
  | 'rate_limited'
  | 'rejected'
  | 'internal_error';
/** Maps an API error response to an internal diagnosis category. Never shown to the browser. */
export function classifyFailure(status: number, code: string): Failure {
  if (code === 'SERVICE_UNAUTHORIZED' || code === 'SERVICE_REPLAY') return 'invalid_hmac';
  if (code === 'SERVICE_FORBIDDEN' || status === 403) return 'forbidden';
  if (status === 401) return 'unauthorized';
  if (status === 429) return 'rate_limited';
  if (status === 503 || status === 502 || status === 504) return 'api_unavailable';
  if (status >= 500) return 'internal_api_error';
  return 'rejected';
}
export class SuburbioApiClient {
  constructor(
    private config: ServerEnv = serverEnv(),
    private transport: typeof fetch = fetch,
  ) {}
  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    options: { method?: 'GET' | 'POST'; body?: unknown; idempotencyKey?: string; degradedHealth?: boolean } = {},
  ): Promise<ApiResult<T>> {
    if (!this.config.SUBURBIO_API_ENABLED) throw new SiteError('API_NOT_CONFIGURED');
    const url = new URL(path, this.config.SUBURBIO_API_URL);
    if (url.origin !== new URL(this.config.SUBURBIO_API_URL!).origin || !path.startsWith('/') || path.startsWith('//'))
      throw new SiteError('INVALID_INPUT', 400);
    const method = options.method ?? 'GET';
    const body = options.body === undefined ? '' : JSON.stringify(options.body);
    const correlationId = randomUUID();
    const headers: Record<string, string> = { Accept: 'application/json', 'X-Correlation-Id': correlationId };
    if (path.startsWith('/internal/'))
      Object.assign(
        headers,
        signedHeaders(
          this.config.SITE_SERVICE_ID,
          this.config.SITE_SERVICE_SECRET!,
          method,
          url.pathname + url.search,
          body,
        ),
      );
    if (body) headers['Content-Type'] = 'application/json';
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
    const trace: Trace = { correlationId };
    const start = performance.now();
    let status: number | undefined;
    let outcome: Failure | 'ok' = 'internal_error';
    try {
      const response = await this.transport(url, {
        method,
        headers,
        body: body || undefined,
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(this.config.SUBURBIO_API_TIMEOUT_MS),
      });
      status = response.status;
      trace.requestId = safeId(response.headers.get('x-request-id'));
      trace.correlationId = safeId(response.headers.get('x-correlation-id')) ?? correlationId;
      if (response.status === 429) {
        outcome = 'rate_limited';
        throw new SiteError('RATE_LIMITED', 429, trace);
      }
      const text = await response.text();
      outcome = 'malformed_response';
      if (text.length > 1_000_000) throw new SiteError('API_INVALID_RESPONSE', 502, trace);
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        throw new SiteError('API_INVALID_RESPONSE', 502, trace);
      }
      if (!response.ok && !(options.degradedHealth && response.status === 503 && schema.safeParse(data).success)) {
        const failure = z
          .object({
            error: z.object({ code: z.string(), operationId: z.string().optional() }),
            requestId: z.string().optional(),
            correlationId: z.string().optional(),
          })
          .safeParse(data);
        const code = failure.success ? failure.data.error.code : '';
        if (failure.success) {
          trace.operationId = safeId(failure.data.error.operationId);
          trace.requestId = safeId(failure.data.requestId) ?? trace.requestId;
        }
        outcome = classifyFailure(response.status, code);
        throw new SiteError(
          knownErrors.has(code) ? code : 'API_OFFLINE',
          response.status >= 400 && response.status < 600 ? response.status : 502,
          trace,
        );
      }
      const parsed = schema.safeParse(data);
      if (!parsed.success) throw new SiteError('API_INVALID_RESPONSE', 502, trace);
      if (typeof data === 'object' && data !== null && 'operationId' in data)
        trace.operationId = safeId(data.operationId);
      outcome = 'ok';
      return { data: parsed.data, trace };
    } catch (error) {
      if (error instanceof SiteError) throw error;
      outcome = error instanceof Error && error.name === 'TimeoutError' ? 'api_timeout' : 'api_unavailable';
      throw new SiteError('API_OFFLINE', 503, trace);
    } finally {
      // Internal diagnosis only: the browser still receives the generic SiteError code.
      logEvent(outcome === 'ok' ? 'info' : 'warn', 'api.request', {
        target: 'suburbio-api',
        operation:
          method + ' ' + url.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id').replace(/d{17,20}/g, ':discordId'),
        status,
        outcome,
        durationMs: Math.round(performance.now() - start),
        correlationId: trace.correlationId,
        requestId: trace.requestId,
        operationId: trace.operationId,
      });
    }
  }
  citizenBalance(customerDiscordId: string) {
    if (!discordIdSchema.safeParse(customerDiscordId).success) throw new SiteError('SESSION_REQUIRED', 401);
    return this.request(`/internal/site/me/crypto?${new URLSearchParams({ customerDiscordId })}`, balanceSchema);
  }
  citizenCharacters(customerDiscordId: string) {
    if (!discordIdSchema.safeParse(customerDiscordId).success) throw new SiteError('SESSION_REQUIRED', 401);
    return this.request(`/internal/site/me/characters?${new URLSearchParams({ customerDiscordId })}`, charactersSchema);
  }
  affiliateAccess(customerDiscordId: string) {
    discordIdSchema.parse(customerDiscordId);
    return this.request(
      '/internal/site/me/affiliate/access?' + new URLSearchParams({ customerDiscordId }),
      z.object({ affiliate: z.boolean() }),
    );
  }
  affiliateDashboard(discordId: string, period = '30', page = 1, id?: string) {
    discordIdSchema.parse(discordId);
    periodSchema.parse(period);
    z.number().int().min(1).max(100000).parse(page);
    if (id) uuid.parse(id);
    return this.request(
      (id ? '/internal/site/affiliates/' + id + '/dashboard' : '/internal/site/me/affiliate') +
        '?' +
        new URLSearchParams({ [id ? 'actorDiscordId' : 'customerDiscordId']: discordId, period, page: String(page) }),
      dashboardSchema,
    );
  }
  referral(code: string) {
    return this.request(
      '/internal/site/affiliates/referral?' + new URLSearchParams({ code: affiliateCode.parse(code) }),
      z.object({ code: affiliateCode, discountPercent: z.number().int(), expiresAt: z.iso.datetime().nullable() }),
    );
  }
  affiliates(actorDiscordId: string, page = 1) {
    discordIdSchema.parse(actorDiscordId);
    z.number().int().min(1).max(100000).parse(page);
    return this.request(
      '/internal/site/affiliates?' + new URLSearchParams({ actorDiscordId, page: String(page) }),
      z.object({ items: z.array(affiliateSchema), page: z.number(), pageSize: z.number(), total: z.number() }),
    );
  }
  affiliate(actorDiscordId: string, id: string) {
    discordIdSchema.parse(actorDiscordId);
    uuid.parse(id);
    return this.request(
      '/internal/site/affiliates/' + id + '?' + new URLSearchParams({ actorDiscordId }),
      affiliateSchema,
    );
  }
  saveAffiliate(actorDiscordId: string, input: unknown, key: string, id?: string) {
    discordIdSchema.parse(actorDiscordId);
    uuid.parse(key);
    if (id) uuid.parse(id);
    return this.request(
      '/internal/site/affiliates' + (id ? '/' + id : ''),
      z.object({ affiliate: affiliateSchema, operationId: uuid }),
      { method: 'POST', body: { ...affiliateMutation.parse(input), actorDiscordId }, idempotencyKey: key },
    );
  }
  affiliatePayouts(actorDiscordId: string, id: string, page = 1) {
    discordIdSchema.parse(actorDiscordId);
    uuid.parse(id);
    z.number().int().min(1).max(100000).parse(page);
    return this.request(
      '/internal/site/affiliates/' + id + '/payouts?' + new URLSearchParams({ actorDiscordId, page: String(page) }),
      z.object({ items: z.array(payoutSchema), page: z.number(), pageSize: z.number() }),
    );
  }
  affiliatePayout(actorDiscordId: string, id: string, input: unknown, key: string) {
    discordIdSchema.parse(actorDiscordId);
    uuid.parse(id);
    uuid.parse(key);
    return this.request(
      '/internal/site/affiliates/' + id + '/payouts',
      z.object({ payout: payoutSchema, operationId: uuid }),
      { method: 'POST', body: { ...payoutInput.parse(input), actorDiscordId }, idempotencyKey: key },
    );
  }
  affiliatePayoutPreview(actorDiscordId: string, id: string) {
    discordIdSchema.parse(actorDiscordId);
    uuid.parse(id);
    return this.request(
      '/internal/site/affiliates/' + id + '/payout-preview?' + new URLSearchParams({ actorDiscordId }),
      z.object({ orderIds: z.array(uuid), grossMinor: z.string(), offsetMinor: z.string(), amountMinor: z.string() }),
    );
  }
  publicHealth() {
    return this.request('/health', healthSchema, { degradedHealth: true });
  }
  entitlements(discordId: string, page = 1, playerId?: string) {
    if (
      !discordIdSchema.safeParse(discordId).success ||
      !Number.isInteger(page) ||
      page < 1 ||
      page > 100000 ||
      (playerId && !uuid.safeParse(playerId).success)
    )
      throw new SiteError('INVALID_INPUT', 400);
    const params = new URLSearchParams({
      [playerId ? 'actorDiscordId' : 'customerDiscordId']: discordId,
      page: String(page),
    });
    return this.request(
      `/internal/site/${playerId ? `players/${playerId}` : 'me'}/entitlements?${params}`,
      entitlementsPage,
    );
  }
  orders(customerDiscordId: string, page = 1) {
    if (!discordIdSchema.safeParse(customerDiscordId).success || !Number.isInteger(page) || page < 1 || page > 100000)
      throw new SiteError('INVALID_INPUT', 400);
    return this.request(
      `/internal/site/orders?${new URLSearchParams({ customerDiscordId, page: String(page) })}`,
      orderListSchema,
    );
  }
  order(customerDiscordId: string, id: string) {
    if (!discordIdSchema.safeParse(customerDiscordId).success || !uuid.safeParse(id).success)
      throw new SiteError('INVALID_INPUT', 400);
    return this.request(`/internal/site/orders/${id}?${new URLSearchParams({ customerDiscordId })}`, orderDetailSchema);
  }
  giftRecipient(customerDiscordId: string, recipientDiscordId: string) {
    if (!discordIdSchema.safeParse(customerDiscordId).success || !discordIdSchema.safeParse(recipientDiscordId).success)
      throw new SiteError('INVALID_INPUT', 400);
    return this.request('/internal/site/gifts/recipient', recipientSchema, {
      method: 'POST',
      body: { customerDiscordId, recipientDiscordId },
    });
  }
  gifts(customerDiscordId: string, direction: 'sent' | 'received', page = 1) {
    if (
      !discordIdSchema.safeParse(customerDiscordId).success ||
      !['sent', 'received'].includes(direction) ||
      !Number.isInteger(page) ||
      page < 1 ||
      page > 10000
    )
      throw new SiteError('INVALID_INPUT', 400);
    return this.request(
      '/internal/site/gifts?' + new URLSearchParams({ customerDiscordId, direction, page: String(page) }),
      giftHistorySchema,
    );
  }
  createOrder(customerDiscordId: string, input: unknown, key: string) {
    if (!discordIdSchema.safeParse(customerDiscordId).success || !uuid.safeParse(key).success)
      throw new SiteError('INVALID_INPUT', 400);
    const parsed = cartInput.extend({ gift: giftInput.optional() }).safeParse(input);
    if (!parsed.success) throw new SiteError('INVALID_INPUT', 400);
    return this.request('/internal/site/orders', z.object({ order: orderSummarySchema, operationId: uuid }), {
      method: 'POST',
      body: { ...parsed.data, customerDiscordId },
      idempotencyKey: key,
    });
  }
  checkout(customerDiscordId: string, id: string, key: string) {
    if (
      !discordIdSchema.safeParse(customerDiscordId).success ||
      !uuid.safeParse(id).success ||
      !uuid.safeParse(key).success
    )
      throw new SiteError('INVALID_INPUT', 400);
    return this.request(
      '/internal/site/orders/' + id + '/checkout',
      z.object({
        checkoutUrl: z.url().refine((v) => {
          const u = new URL(v);
          return (
            u.protocol === 'https:' &&
            !u.username &&
            !u.password &&
            ['www.mercadopago.com.br', 'sandbox.mercadopago.com.br'].includes(u.hostname)
          );
        }),
        operationId: uuid,
      }),
      { method: 'POST', body: { customerDiscordId }, idempotencyKey: key },
    );
  }
  cancelOrder(customerDiscordId: string, id: string, key: string) {
    if (
      !discordIdSchema.safeParse(customerDiscordId).success ||
      !uuid.safeParse(id).success ||
      !uuid.safeParse(key).success
    )
      throw new SiteError('INVALID_INPUT', 400);
    return this.request(
      `/internal/site/orders/${id}/cancel`,
      z.object({ order: orderSummarySchema, operationId: uuid }),
      { method: 'POST', body: { customerDiscordId }, idempotencyKey: key },
    );
  }
  health() {
    return this.request('/internal/health', internalHealthSchema, { degradedHealth: true });
  }
  catalog() {
    return this.request('/internal/site/catalog', catalogSchema);
  }
  coupons(actorDiscordId: string, page = 1) {
    if (!discordIdSchema.safeParse(actorDiscordId).success || !Number.isInteger(page) || page < 1 || page > 100000)
      throw new SiteError('INVALID_INPUT', 400);
    return this.request(
      `/internal/site/coupons?${new URLSearchParams({ actorDiscordId, page: String(page) })}`,
      z.object({
        items: z.array(couponSchema.safeExtend({ metrics: couponMetricsSchema })),
        page: z.number(),
        pageSize: z.number(),
        total: z.number(),
      }),
    );
  }
  coupon(actorDiscordId: string, id: string) {
    if (!discordIdSchema.safeParse(actorDiscordId).success || !uuid.safeParse(id).success)
      throw new SiteError('INVALID_INPUT', 400);
    return this.request(
      `/internal/site/coupons/${id}?${new URLSearchParams({ actorDiscordId })}`,
      couponSchema.safeExtend({ metrics: couponMetricsSchema }),
    );
  }
  saveCoupon(actorDiscordId: string, coupon: CouponInput, key: string, id?: string, expectedRevision?: number) {
    if (
      !discordIdSchema.safeParse(actorDiscordId).success ||
      !couponInput.safeParse(coupon).success ||
      !/^[A-Za-z0-9:_-]{8,128}$/.test(key) ||
      (id && (!uuid.safeParse(id).success || !Number.isInteger(expectedRevision) || expectedRevision! < 1))
    )
      throw new SiteError('INVALID_INPUT', 400);
    return this.request(
      `/internal/site/coupons${id ? `/${id}` : ''}`,
      z.object({ coupon: couponSchema, operationId: uuid }),
      { method: 'POST', idempotencyKey: key, body: { actorDiscordId, coupon, ...(id ? { expectedRevision } : {}) } },
    );
  }
  cryptoConfig() {
    return this.request('/internal/site/crypto', cryptoConfigSchema);
  }
  cryptoQuote(input: unknown) {
    const value = cryptoInput.safeParse(input);
    if (!value.success) throw new SiteError('INVALID_INPUT', 400);
    return this.request('/internal/site/crypto/quote', cryptoQuoteSchema, { method: 'POST', body: value.data });
  }
  cartQuote(input: unknown, customerDiscordId: string) {
    if (!discordIdSchema.safeParse(customerDiscordId).success) throw new SiteError('SESSION_REQUIRED', 401);
    const value = cartInput.safeParse(input);
    if (!value.success) throw new SiteError('INVALID_INPUT', 400);
    return this.request('/internal/site/cart/quote', cartQuoteSchema, {
      method: 'POST',
      body: { ...value.data, customerDiscordId },
    });
  }
  products(actorDiscordId: string, page = 1, q = '') {
    if (
      !discordIdSchema.safeParse(actorDiscordId).success ||
      !Number.isInteger(page) ||
      page < 1 ||
      page > 100000 ||
      q.length > 100
    )
      throw new SiteError('INVALID_INPUT', 400);
    return this.request(
      `/internal/site/products?${new URLSearchParams({ actorDiscordId, page: String(page), q })}`,
      z.object({
        items: z.array(productSchema),
        page: z.number().int(),
        pageSize: z.number().int(),
        total: z.number().int(),
      }),
    );
  }
  product(actorDiscordId: string, id: string) {
    if (!discordIdSchema.safeParse(actorDiscordId).success || !uuid.safeParse(id).success)
      throw new SiteError('INVALID_INPUT', 400);
    return this.request(`/internal/site/products/${id}?${new URLSearchParams({ actorDiscordId })}`, productSchema);
  }
  categories(actorDiscordId: string) {
    if (!discordIdSchema.safeParse(actorDiscordId).success) throw new SiteError('INVALID_INPUT', 400);
    return this.request(
      `/internal/site/categories?${new URLSearchParams({ actorDiscordId })}`,
      z.object({ items: z.array(categorySchema) }),
    );
  }
  saveProduct(actorDiscordId: string, product: ProductInput, key: string, id?: string, expectedRevision?: number) {
    if (
      !discordIdSchema.safeParse(actorDiscordId).success ||
      !productInput.safeParse(product).success ||
      !/^[A-Za-z0-9:_-]{8,128}$/.test(key) ||
      (id && (!uuid.safeParse(id).success || !Number.isInteger(expectedRevision) || expectedRevision! < 1))
    )
      throw new SiteError('INVALID_INPUT', 400);
    return this.request(
      `/internal/site/products${id ? `/${id}` : ''}`,
      z.object({ product: productSchema, catalogVersion: z.string(), operationId: uuid }),
      { method: 'POST', idempotencyKey: key, body: { actorDiscordId, product, ...(id ? { expectedRevision } : {}) } },
    );
  }
  saveCategory(actorDiscordId: string, category: CategoryInput, key: string, id?: string, expectedRevision?: number) {
    if (
      !discordIdSchema.safeParse(actorDiscordId).success ||
      !categoryInput.safeParse(category).success ||
      !/^[A-Za-z0-9:_-]{8,128}$/.test(key) ||
      (id && (!uuid.safeParse(id).success || !Number.isInteger(expectedRevision) || expectedRevision! < 1))
    )
      throw new SiteError('INVALID_INPUT', 400);
    return this.request(
      `/internal/site/categories${id ? `/${id}` : ''}`,
      z.object({ category: categorySchema, catalogVersion: z.string(), operationId: uuid }),
      { method: 'POST', idempotencyKey: key, body: { actorDiscordId, category, ...(id ? { expectedRevision } : {}) } },
    );
  }
  discordRoleMappings(actorDiscordId: string) {
    if (!discordIdSchema.safeParse(actorDiscordId).success) throw new SiteError('INVALID_INPUT', 400);
    return this.request(
      `/internal/site/discord-role-mappings?${new URLSearchParams({ actorDiscordId })}`,
      z.object({
        items: z.array(
          z.object({
            guild_id: discordIdSchema,
            role_id: discordIdSchema,
            label: z.string(),
            enabled: z.boolean(),
            is_owner: z.boolean(),
            capabilities: z.array(z.string()),
          }),
        ),
      }),
    );
  }
  resolveAdmin(discordId: string, membership?: Membership) {
    if (!discordIdSchema.safeParse(discordId).success) throw new SiteError('INVALID_INPUT', 400);
    return this.request('/internal/site/admin/resolve', adminResolutionSchema, {
      method: 'POST',
      body: { discordId, ...(membership ? { membership } : {}) },
      ...(membership ? { idempotencyKey: randomUUID() } : {}),
    });
  }
  admins(actorDiscordId: string, page = 1, q = '', status?: string) {
    if (
      !discordIdSchema.safeParse(actorDiscordId).success ||
      !Number.isInteger(page) ||
      page < 1 ||
      page > 100000 ||
      q.length > 100 ||
      (status && !['active', 'disabled'].includes(status))
    )
      throw new SiteError('INVALID_INPUT', 400);
    const query = new URLSearchParams({ actorDiscordId, page: String(page), pageSize: '25', q });
    if (status) query.set('status', status);
    return this.request(`/internal/site/admins?${query}`, adminListSchema);
  }
  admin(actorDiscordId: string, id: string) {
    if (!discordIdSchema.safeParse(actorDiscordId).success || !uuid.safeParse(id).success)
      throw new SiteError('INVALID_INPUT', 400);
    return this.request(`/internal/site/admins/${id}?${new URLSearchParams({ actorDiscordId })}`, adminSummarySchema);
  }
  allowlist(playerId: string) {
    if (!uuid.safeParse(playerId).success) throw new SiteError('INVALID_INPUT', 400);
    return this.request(`/internal/allowlist/${playerId}`, allowlistSchema);
  }
  revoke(playerId: string, reason: string, actorDiscordId: string, idempotencyKey: string) {
    if (
      !uuid.safeParse(playerId).success ||
      !discordIdSchema.safeParse(actorDiscordId).success ||
      reason.trim().length < 3 ||
      reason.trim().length > 500 ||
      !/^[A-Za-z0-9:_-]{8,128}$/.test(idempotencyKey)
    )
      throw new SiteError('INVALID_INPUT', 400);
    return this.request('/internal/allowlist/revoke', revokeResultSchema, {
      method: 'POST',
      body: { playerId, reason: reason.trim(), actorDiscordId },
      idempotencyKey,
    });
  }
  operation(operationId: string) {
    if (!uuid.safeParse(operationId).success) throw new SiteError('INVALID_INPUT', 400);
    return this.request(`/internal/operations/${operationId}`, operationSchema);
  }
}
