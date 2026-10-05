import 'server-only';
import { createHash, createHmac, randomBytes } from 'node:crypto';

// Exact contract: Subúrbio API v0.2 src/security/hmac.ts.
export const bodyHash = (body: string | Buffer) => createHash('sha256').update(body).digest('hex');
export function signRequest(
  secret: string,
  method: string,
  path: string,
  timestamp: string,
  nonce: string,
  body: string | Buffer,
) {
  return createHmac('sha256', secret)
    .update([method.toUpperCase(), path, timestamp, nonce, bodyHash(body)].join('\n'))
    .digest('hex');
}
export function signedHeaders(serviceId: string, secret: string, method: string, path: string, body = '') {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomBytes(24).toString('base64url');
  return {
    'X-Service-Id': serviceId,
    'X-Timestamp': timestamp,
    'X-Nonce': nonce,
    'X-Signature': signRequest(secret, method, path, timestamp, nonce, body),
  };
}
