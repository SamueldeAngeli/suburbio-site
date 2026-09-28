import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { serverEnv, type ServerEnv } from '@/lib/server/env';
import { SiteError, type Trace } from './errors';
import { signedHeaders } from './hmac';
import {orderListSchema,orderDetailSchema,orderSummarySchema} from './order-contracts';
import {entitlementsPage} from './entitlement-contracts';
import {cryptoInput,cryptoConfigSchema,cryptoQuoteSchema,cartInput,cartQuoteSchema} from './cart-contracts';
import {couponInput,couponSchema,couponMetricsSchema,type CouponInput} from './coupon-contracts';
import { productSchema, categorySchema, productInput, categoryInput, catalogSchema, type ProductInput, type CategoryInput } from './catalog-contracts';
import { healthSchema, internalHealthSchema, allowlistSchema, revokeResultSchema, operationSchema, uuid, discordIdSchema, adminResolutionSchema, adminListSchema, adminSummarySchema } from './contracts';

export type ApiResult<T> = { data: T; trace: Trace };
const safeId = (v: unknown) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(v) ? v : undefined;
const knownErrors = new Set(['ORDER_NOT_FOUND','ORDER_CANNOT_CANCEL','PLAYER_LINK_REQUIRED','CHARACTER_NOT_OWNED','ORDER_LIMIT_REACHED','ORDER_AMOUNT_INVALID','API_READ_ONLY','ADMIN_ACCESS_DENIED','ADMIN_CAPABILITY_REQUIRED','ALLOWLIST_NOT_FOUND','IDEMPOTENCY_CONFLICT','REVISION_CONFLICT','SLUG_CONFLICT','CATEGORY_NOT_ACTIVE','PRODUCT_NOT_FOUND','ADMIN_NOT_FOUND','COUPON_NOT_FOUND','COUPON_NOT_ELIGIBLE','COUPON_CODE_CONFLICT','STOCK_UNAVAILABLE','PRODUCT_UNAVAILABLE','CRYPTO_QUANTITY_INVALID','CRYPTO_PACKAGE_INVALID']);
export class SuburbioApiClient {
  constructor(private config: ServerEnv = serverEnv(), private transport: typeof fetch = fetch) {}
  private async request<T>(path: string, schema: z.ZodType<T>, options: { method?: 'GET' | 'POST'; body?: unknown; idempotencyKey?: string; degradedHealth?: boolean } = {}): Promise<ApiResult<T>> {
    if (!this.config.SUBURBIO_API_ENABLED) throw new SiteError('API_NOT_CONFIGURED');
    const url = new URL(path, this.config.SUBURBIO_API_URL);
    if (url.origin !== new URL(this.config.SUBURBIO_API_URL!).origin || !path.startsWith('/') || path.startsWith('//')) throw new SiteError('INVALID_INPUT', 400);
    const method = options.method ?? 'GET';
    const body = options.body === undefined ? '' : JSON.stringify(options.body);
    const correlationId = randomUUID();
    const headers: Record<string, string> = { Accept: 'application/json', 'X-Correlation-Id': correlationId };
    if (path.startsWith('/internal/')) Object.assign(headers, signedHeaders(this.config.SITE_SERVICE_ID, this.config.SITE_SERVICE_SECRET!, method, url.pathname + url.search, body));
    if (body) headers['Content-Type'] = 'application/json';
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
    const trace: Trace = { correlationId };
    const start = performance.now();
    let result = 'failed';
    try {
      const response = await this.transport(url, { method, headers, body: body || undefined, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(this.config.API_TIMEOUT_MS) });
      trace.requestId = safeId(response.headers.get('x-request-id'));
      trace.correlationId = safeId(response.headers.get('x-correlation-id')) ?? correlationId;
      if (response.status === 429) throw new SiteError('RATE_LIMITED', 429, trace);
      const text = await response.text();
      if (text.length > 1_000_000) throw new SiteError('API_INVALID_RESPONSE', 502, trace);
      let data: unknown;
      try { data = JSON.parse(text); } catch { throw new SiteError('API_INVALID_RESPONSE', 502, trace); }
      if (!response.ok && !(options.degradedHealth && response.status === 503 && schema.safeParse(data).success)) {
        const failure = z.object({ error: z.object({ code: z.string(), operationId: z.string().optional() }), requestId: z.string().optional(), correlationId: z.string().optional() }).safeParse(data);
        const code = failure.success ? failure.data.error.code : '';
        if (failure.success) {
          trace.operationId = safeId(failure.data.error.operationId);
          trace.requestId = safeId(failure.data.requestId) ?? trace.requestId;
        }
        throw new SiteError(response.status === 429 ? 'RATE_LIMITED' : knownErrors.has(code) ? code : 'API_OFFLINE', response.status >= 400 && response.status < 600 ? response.status : 502, trace);
      }
      const parsed = schema.safeParse(data);
      if (!parsed.success) throw new SiteError('API_INVALID_RESPONSE', 502, trace);
      if (typeof data === 'object' && data !== null && 'operationId' in data) trace.operationId = safeId(data.operationId);
      result = 'ok';
      return { data: parsed.data, trace };
    } catch (error) {
      if (error instanceof SiteError) throw error;
      throw new SiteError('API_OFFLINE', 503, trace);
    } finally {
      console.info(JSON.stringify({ module: 'suburbio-api', route: path.split('?')[0].replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id'), durationMs: Math.round(performance.now() - start), result, ...trace }));
    }
  }
  publicHealth() { return this.request('/health', healthSchema, { degradedHealth: true }); }
  entitlements(discordId:string,page=1,playerId?:string){if(!discordIdSchema.safeParse(discordId).success||!Number.isInteger(page)||page<1||page>100000||(playerId&&!uuid.safeParse(playerId).success))throw new SiteError('INVALID_INPUT',400);const params=new URLSearchParams({[playerId?'actorDiscordId':'customerDiscordId']:discordId,page:String(page)});return this.request(`/internal/site/${playerId?`players/${playerId}`:'me'}/entitlements?${params}`,entitlementsPage);}
  orders(customerDiscordId:string,page=1){if(!discordIdSchema.safeParse(customerDiscordId).success||!Number.isInteger(page)||page<1||page>100000)throw new SiteError('INVALID_INPUT',400);return this.request(`/internal/site/orders?${new URLSearchParams({customerDiscordId,page:String(page)})}`,orderListSchema);}
  order(customerDiscordId:string,id:string){if(!discordIdSchema.safeParse(customerDiscordId).success||!uuid.safeParse(id).success)throw new SiteError('INVALID_INPUT',400);return this.request(`/internal/site/orders/${id}?${new URLSearchParams({customerDiscordId})}`,orderDetailSchema);}
  cancelOrder(customerDiscordId:string,id:string,key:string){if(!discordIdSchema.safeParse(customerDiscordId).success||!uuid.safeParse(id).success||!uuid.safeParse(key).success)throw new SiteError('INVALID_INPUT',400);return this.request(`/internal/site/orders/${id}/cancel`,z.object({order:orderSummarySchema,operationId:uuid}),{method:'POST',body:{customerDiscordId},idempotencyKey:key});}
  health() { return this.request('/internal/health', internalHealthSchema, { degradedHealth: true }); }
  catalog() { return this.request('/internal/site/catalog',catalogSchema); }
  coupons(actorDiscordId:string,page=1){if(!discordIdSchema.safeParse(actorDiscordId).success||!Number.isInteger(page)||page<1||page>100000)throw new SiteError('INVALID_INPUT',400);return this.request(`/internal/site/coupons?${new URLSearchParams({actorDiscordId,page:String(page)})}`,z.object({items:z.array(couponSchema.safeExtend({metrics:couponMetricsSchema})),page:z.number(),pageSize:z.number(),total:z.number()}));}
  coupon(actorDiscordId:string,id:string){if(!discordIdSchema.safeParse(actorDiscordId).success||!uuid.safeParse(id).success)throw new SiteError('INVALID_INPUT',400);return this.request(`/internal/site/coupons/${id}?${new URLSearchParams({actorDiscordId})}`,couponSchema.safeExtend({metrics:couponMetricsSchema}));}
  saveCoupon(actorDiscordId:string,coupon:CouponInput,key:string,id?:string,expectedRevision?:number){if(!discordIdSchema.safeParse(actorDiscordId).success||!couponInput.safeParse(coupon).success||!/^[A-Za-z0-9:_-]{8,128}$/.test(key)||(id&&(!uuid.safeParse(id).success||!Number.isInteger(expectedRevision)||expectedRevision!<1)))throw new SiteError('INVALID_INPUT',400);return this.request(`/internal/site/coupons${id?`/${id}`:''}`,z.object({coupon:couponSchema,operationId:uuid}),{method:'POST',idempotencyKey:key,body:{actorDiscordId,coupon,...(id?{expectedRevision}:{})}});}
  cryptoConfig() { return this.request('/internal/site/crypto',cryptoConfigSchema); }
  cryptoQuote(input:unknown) { const value=cryptoInput.safeParse(input);if(!value.success)throw new SiteError('INVALID_INPUT',400);return this.request('/internal/site/crypto/quote',cryptoQuoteSchema,{method:'POST',body:value.data}); }
  cartQuote(input:unknown,customerDiscordId:string) { if(!discordIdSchema.safeParse(customerDiscordId).success)throw new SiteError('SESSION_REQUIRED',401); const value=cartInput.safeParse(input);if(!value.success)throw new SiteError('INVALID_INPUT',400);return this.request('/internal/site/cart/quote',cartQuoteSchema,{method:'POST',body:{...value.data,customerDiscordId}}); }
  products(actorDiscordId: string, page = 1, q = '') {
    if (!discordIdSchema.safeParse(actorDiscordId).success || !Number.isInteger(page) || page < 1 || page > 100000 || q.length > 100) throw new SiteError('INVALID_INPUT',400);
    return this.request(`/internal/site/products?${new URLSearchParams({actorDiscordId,page:String(page),q})}`,z.object({items:z.array(productSchema),page:z.number().int(),pageSize:z.number().int(),total:z.number().int()}));
  }
  product(actorDiscordId: string, id: string) {
    if (!discordIdSchema.safeParse(actorDiscordId).success || !uuid.safeParse(id).success) throw new SiteError('INVALID_INPUT',400);
    return this.request(`/internal/site/products/${id}?${new URLSearchParams({actorDiscordId})}`,productSchema);
  }
  categories(actorDiscordId: string) {
    if (!discordIdSchema.safeParse(actorDiscordId).success) throw new SiteError('INVALID_INPUT',400);
    return this.request(`/internal/site/categories?${new URLSearchParams({actorDiscordId})}`,z.object({items:z.array(categorySchema)}));
  }
  saveProduct(actorDiscordId: string, product: ProductInput, key: string, id?: string, expectedRevision?: number) {
    if (!discordIdSchema.safeParse(actorDiscordId).success || !productInput.safeParse(product).success || !/^[A-Za-z0-9:_-]{8,128}$/.test(key) || (id && (!uuid.safeParse(id).success || !Number.isInteger(expectedRevision) || expectedRevision! < 1))) throw new SiteError('INVALID_INPUT',400);
    return this.request(`/internal/site/products${id?`/${id}`:''}`,z.object({product:productSchema,catalogVersion:z.string(),operationId:uuid}),{method:'POST',idempotencyKey:key,body:{actorDiscordId,product,...(id?{expectedRevision}:{})}});
  }
  saveCategory(actorDiscordId: string, category: CategoryInput, key: string, id?: string, expectedRevision?: number) {
    if (!discordIdSchema.safeParse(actorDiscordId).success || !categoryInput.safeParse(category).success || !/^[A-Za-z0-9:_-]{8,128}$/.test(key) || (id && (!uuid.safeParse(id).success || !Number.isInteger(expectedRevision) || expectedRevision! < 1))) throw new SiteError('INVALID_INPUT',400);
    return this.request(`/internal/site/categories${id?`/${id}`:''}`,z.object({category:categorySchema,catalogVersion:z.string(),operationId:uuid}),{method:'POST',idempotencyKey:key,body:{actorDiscordId,category,...(id?{expectedRevision}:{})}});
  }
  resolveAdmin(discordId: string) {
    if (!discordIdSchema.safeParse(discordId).success) throw new SiteError('INVALID_INPUT', 400);
    return this.request('/internal/site/admin/resolve', adminResolutionSchema, { method: 'POST', body: { discordId } });
  }
  admins(actorDiscordId: string, page = 1, q = '', status?: string) {
    if (!discordIdSchema.safeParse(actorDiscordId).success || !Number.isInteger(page) || page < 1 || page > 100000 || q.length > 100 || (status && !['active','disabled'].includes(status))) throw new SiteError('INVALID_INPUT',400);
    const query = new URLSearchParams({actorDiscordId, page: String(page), pageSize: '25', q});
    if (status) query.set('status',status);
    return this.request(`/internal/site/admins?${query}`, adminListSchema);
  }
  admin(actorDiscordId: string, id: string) {
    if (!discordIdSchema.safeParse(actorDiscordId).success || !uuid.safeParse(id).success) throw new SiteError('INVALID_INPUT',400);
    return this.request(`/internal/site/admins/${id}?${new URLSearchParams({actorDiscordId})}`, adminSummarySchema);
  }
  allowlist(playerId: string) { if (!uuid.safeParse(playerId).success) throw new SiteError('INVALID_INPUT', 400); return this.request(`/internal/allowlist/${playerId}`, allowlistSchema); }
  revoke(playerId: string, reason: string, actorDiscordId: string, idempotencyKey: string) {
    if (!uuid.safeParse(playerId).success || !discordIdSchema.safeParse(actorDiscordId).success || reason.trim().length < 3 || reason.trim().length > 500 || !/^[A-Za-z0-9:_-]{8,128}$/.test(idempotencyKey)) throw new SiteError('INVALID_INPUT', 400);
    return this.request('/internal/allowlist/revoke', revokeResultSchema, { method: 'POST', body: { playerId, reason: reason.trim(), actorDiscordId }, idempotencyKey });
  }
  operation(operationId: string) { if (!uuid.safeParse(operationId).success) throw new SiteError('INVALID_INPUT', 400); return this.request(`/internal/operations/${operationId}`, operationSchema); }
}
