import 'server-only';
import { logEvent } from '@/lib/server/log';

// Diagnóstico do Auth.js sem vazar segredos: tipo/nome/código e mensagens com redação.
// Nunca registra access/refresh token, client secret, cookies, Authorization, code OAuth ou state.
const REDACTIONS: [RegExp, string][] = [
  [/\b(code|state|access_token|refresh_token|id_token|client_secret|token|session_state)=[^&\s"']+/gi, '$1=[redacted]'],
  [/\b(Bearer|Basic)\s+[^\s"']+/gi, '$1 [redacted]'],
  [/(cookie|authorization)\s*[:=]\s*[^\n"']+/gi, '$1: [redacted]'],
  // Valores longos com cara de token/secret/código (IDs do Discord têm até 20 dígitos).
  [/[A-Za-z0-9_\-.~+/]{24,}={0,2}/g, '[redacted]'],
];
export function redactAuthText(value: unknown) {
  if (typeof value !== 'string' || !value) return undefined;
  let text = value;
  for (const [pattern, replacement] of REDACTIONS) text = text.replace(pattern, replacement);
  return text.slice(0, 300);
}
const shortCode = (value: unknown) =>
  typeof value === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(value) ? value : undefined;

export const authLogger = {
  error(error: Error) {
    const cause = (error as { cause?: { err?: unknown } }).cause;
    const inner = cause?.err instanceof Error ? cause.err : undefined;
    logEvent('error', 'auth.error', {
      authType: shortCode((error as { type?: unknown }).type),
      errorName: shortCode(error.name),
      message: redactAuthText(error.message),
      causeName: shortCode(inner?.name),
      causeCode: shortCode((inner as { code?: unknown } | undefined)?.code),
      causeMessage: redactAuthText(inner?.message),
    });
  },
  warn(code: string) {
    logEvent('warn', 'auth.warning', { code: shortCode(code) });
  },
  debug() {},
};
