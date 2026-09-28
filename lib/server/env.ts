import 'server-only';
import { z } from 'zod';

const enabled = z.enum(['true', 'false']).default('false').transform(v => v === 'true');
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  AUTH_ENABLED: enabled,
  SUBURBIO_API_ENABLED: enabled,
  AUTH_URL: z.string().optional(),
  AUTH_SECRET: z.string().optional(),
  AUTH_SECRET_PREVIOUS: z.string().optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  DISCORD_REDIRECT_URI: z.string().optional(),
  SUBURBIO_API_URL: z.string().optional(),
  SITE_SERVICE_ID: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/).default('site'),
  SITE_SERVICE_SECRET: z.string().optional(),
  API_TIMEOUT_MS: z.coerce.number().int().min(500).max(30000).default(5000),
});
export function parseServerEnv(raw: Record<string, string | undefined>) {
  const result = schema.safeParse(raw);
  if (!result.success) throw new Error(`Configuração inválida: ${result.error.issues.map(i => i.path.join('.')).join(', ')}`);
  const env = result.data;
  const required = (key: keyof typeof env, length = 1) => {
    if (typeof env[key] !== 'string' || (env[key] as string).length < length) throw new Error(`Configuração ausente ou inválida: ${key}`);
  };
  const origin = (key: 'AUTH_URL' | 'SUBURBIO_API_URL') => {
    required(key);
    let url: URL;
    try { url = new URL(env[key]!); } catch { throw new Error(`URL inválida: ${key}`); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error(`Origem inválida: ${key}`);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (env.NODE_ENV === 'production' && url.protocol !== 'https:' && !(key === 'SUBURBIO_API_URL' && loopback)) throw new Error(`HTTPS obrigatório: ${key}`);
    return url;
  };
  if (env.AUTH_ENABLED) {
    const url = origin('AUTH_URL');
    required('AUTH_SECRET', 32);
    required('DISCORD_CLIENT_SECRET', 16);
    if (!/^\d{17,20}$/.test(env.DISCORD_CLIENT_ID ?? '')) throw new Error('Configuração inválida: DISCORD_CLIENT_ID');
    if (env.DISCORD_REDIRECT_URI !== `${url.origin}/api/auth/callback/discord`) throw new Error('DISCORD_REDIRECT_URI deve corresponder ao callback em AUTH_URL');
    if (env.AUTH_SECRET_PREVIOUS && env.AUTH_SECRET_PREVIOUS.length < 32) throw new Error('Configuração inválida: AUTH_SECRET_PREVIOUS');
  }
  if (env.SUBURBIO_API_ENABLED) { origin('SUBURBIO_API_URL'); required('SITE_SERVICE_SECRET', 32); }
  return env;
}
export type ServerEnv = ReturnType<typeof parseServerEnv>;
export const serverEnv = () => parseServerEnv(process.env);
