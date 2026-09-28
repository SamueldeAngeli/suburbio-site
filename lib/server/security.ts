import 'server-only';
import { SiteError } from '@/lib/api/errors';

export class WindowLimiter {
  private buckets = new Map<string, { count: number; until: number }>();
  constructor(private capacity = 10000) {}
  consume(key: string, limit: number, windowMs = 60000, now = Date.now()) {
    for (const [id, value] of this.buckets) if (value.until <= now) this.buckets.delete(id);
    const old = this.buckets.get(key);
    if (!old && this.buckets.size >= this.capacity) throw new SiteError('RATE_LIMITED', 429);
    const bucket = old ?? { count: 0, until: now + windowMs };
    if (bucket.count >= limit) throw new SiteError('RATE_LIMITED', 429);
    bucket.count++;
    this.buckets.set(key, bucket);
  }
}
// Process-local backstop. Edge/proxy limits are mandatory for multi-instance deployment.
export const limiter = new WindowLimiter();
export function assertOrigin(headers: Headers, origin: string | undefined) {
  if (!origin || headers.get('origin') !== new URL(origin).origin) throw new SiteError('INVALID_ORIGIN', 403);
  const fetchSite = headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') throw new SiteError('INVALID_ORIGIN', 403);
}
export async function readJson(request: Request, maxBytes = 4096): Promise<unknown> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new SiteError('INVALID_INPUT', 415);
  if (Number(request.headers.get('content-length')) > maxBytes || !request.body) throw new SiteError('INVALID_INPUT', 413);
  const reader = request.body.getReader();
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) { const chunk = await reader.read(); if (chunk.done) break; length += chunk.value.length; if (length > maxBytes) { await reader.cancel(); throw new SiteError('INVALID_INPUT', 413); } chunks.push(chunk.value); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch (error) { if (error instanceof SiteError) throw error; throw new SiteError('INVALID_INPUT', 400); }
}
export function safeReturnTo(value: unknown) {
  if (typeof value !== 'string' || !/^\/(?:admin(?:\/[a-zA-Z0-9_-]+)*|minha-conta)$/.test(value)) return '/minha-conta';
  return value;
}
