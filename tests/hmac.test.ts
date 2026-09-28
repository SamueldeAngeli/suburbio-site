import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { bodyHash, signRequest, signedHeaders } from '@/lib/api/hmac';
describe('HMAC oficial v0.2', () => {
  const secret = 'only-a-test-secret';
  const args = ['POST','/internal/allowlist/revoke','1700000000','test_nonce_1234567890','{"reason":"ação"}'] as const;
  it('hash SHA256 conhecido do corpo vazio', () => expect(bodyHash('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'));
  it('assina o contrato de cinco linhas em hexadecimal', () => {
    const canonical = `${args[0]}\n${args[1]}\n${args[2]}\n${args[3]}\n${bodyHash(args[4])}`;
    expect(signRequest(secret,...args)).toBe(createHmac('sha256',secret).update(canonical).digest('hex'));
  });
  it('normaliza método para uppercase', () => expect(signRequest(secret,'post',...args.slice(1) as [string,string,string,string])).toBe(signRequest(secret,...args)));
  it.each(['method','path','timestamp','nonce','body'])('alterar %s invalida assinatura', field => {
    const values: [string,string,string,string,string] = [...args]; const i = ['method','path','timestamp','nonce','body'].indexOf(field); values[i] += 'x';
    expect(signRequest(secret,...values)).not.toBe(signRequest(secret,...args));
  });
  it('secret incorreto invalida assinatura', () => expect(signRequest('wrong',...args)).not.toBe(signRequest(secret,...args)));
  it('corpo assinado preserva bytes UTF-8', () => expect(bodyHash(Buffer.from(args[4]))).toBe(bodyHash(args[4])));
  it('query e sua ordem participam da assinatura', () => expect(signRequest(secret,'GET','/internal/test?a=1&b=2','1700000000','nonce','')).not.toBe(signRequest(secret,'GET','/internal/test?b=2&a=1','1700000000','nonce','')));
  it('nonces novos e timestamp em segundos', () => { const headers = Array.from({length:100},()=>signedHeaders('site',secret,'GET','/internal/health')); expect(new Set(headers.map(h=>h['X-Nonce'])).size).toBe(100); expect(headers[0]['X-Timestamp']).toMatch(/^\d{10}$/); expect(headers[0]['X-Nonce']).toMatch(/^[A-Za-z0-9_-]{16,128}$/); expect(headers[0]['X-Signature']).toMatch(/^[a-f0-9]{64}$/); });
});
