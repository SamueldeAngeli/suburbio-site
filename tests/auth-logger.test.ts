import { afterEach, expect, it, vi } from 'vitest';
import { authLogger, redactAuthText } from '@/lib/auth/logger';

afterEach(() => vi.restoreAllMocks());
const captured = () => {
  const lines: string[] = [];
  vi.spyOn(console, 'error').mockImplementation((line: string) => lines.push(line));
  vi.spyOn(console, 'warn').mockImplementation((line: string) => lines.push(line));
  return lines;
};

it('preserva tipo, nome e causa do erro do Auth.js', () => {
  const lines = captured();
  const inner = Object.assign(new Error('unexpected "iss" (issuer) response parameter value'), {
    name: 'OperationProcessingError',
    code: 'OAUTH_INVALID_RESPONSE',
  });
  const error = Object.assign(new Error('Read more at https://errors.authjs.dev#callbackrouteerror'), {
    name: 'CallbackRouteError',
    type: 'CallbackRouteError',
    cause: { err: inner },
  });
  authLogger.error(error);
  const event = JSON.parse(lines[0]!);
  expect(event).toMatchObject({
    event: 'auth.error',
    authType: 'CallbackRouteError',
    errorName: 'CallbackRouteError',
    causeName: 'OperationProcessingError',
    causeCode: 'OAUTH_INVALID_RESPONSE',
  });
  expect(event.causeMessage).toContain('unexpected "iss"');
});

it.each([
  ['code=Abc123secretOAuthCode&state=xyzState987', ['Abc123secretOAuthCode', 'xyzState987']],
  ['access_token=tok_123456 refresh_token=ref_654321', ['tok_123456', 'ref_654321']],
  ['Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig', ['eyJhbGciOiJIUzI1NiJ9']],
  ['cookie: __Secure-authjs.session-token=abc', ['abc', 'session-token=']],
  ['client_secret=SuperSecretValue123', ['SuperSecretValue123']],
  ['falhou com aGVsbG8td29ybGQtdGhpcy1pcy1hLWxvbmctc2VjcmV0', ['aGVsbG8td29ybGQtdGhpcy1pcy1hLWxvbmctc2VjcmV0']],
])('redige segredos em %s', (input, hidden) => {
  const out = redactAuthText(input)!;
  for (const secret of hidden) expect(out).not.toContain(secret);
});

it('erro com segredo na mensagem nunca chega ao log', () => {
  const lines = captured();
  authLogger.error(
    Object.assign(new Error('token request failed code=SECRETCODE123 client_secret=TOPSECRET999'), {
      type: 'CallbackRouteError',
      cause: { err: new Error('Bearer abcdefghijklmnopqrstuvwxyz0123') },
    }),
  );
  for (const secret of ['SECRETCODE123', 'TOPSECRET999', 'abcdefghijklmnopqrstuvwxyz0123'])
    expect(lines[0]).not.toContain(secret);
});

it('warning registra só o código', () => {
  const lines = captured();
  authLogger.warn('debug-enabled');
  expect(JSON.parse(lines[0]!)).toMatchObject({ event: 'auth.warning', code: 'debug-enabled' });
});
