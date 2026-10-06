import 'server-only';
import { isIP } from 'node:net';
import { z } from 'zod';

const enabled = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  AUTH_ENABLED: enabled,
  SUBURBIO_API_ENABLED: enabled,
  AUTH_URL: z.string().optional(),
  AUTH_SECRET: z.string().optional(),
  AUTH_SECRET_PREVIOUS: z.string().optional(),
  DISCORD_ROLE_AUTH_ENABLED: enabled,
  DISCORD_GUILD_ID: z
    .string()
    .regex(/^\d{17,20}$/)
    .default('876948887695405066'),
  DISCORD_ROLE_REFRESH_SECONDS: z.coerce.number().int().min(10).max(60).default(30),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  DISCORD_REDIRECT_URI: z.string().optional(),
  SUBURBIO_API_URL: z.string().optional(),
  SITE_SERVICE_ID: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,64}$/)
    .default('site'),
  SITE_SERVICE_SECRET: z.string().optional(),
  SUBURBIO_API_TIMEOUT_MS: z.coerce.number().int().min(500).max(30000).default(5000),
  LIVEKIT_ENABLED: enabled,
  LIVEKIT_INTERNAL_URL: z.string().optional(),
  LIVEKIT_PUBLIC_URL: z.string().optional(),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
  // Teto de participantes por sala (anfitrião incluso); cada sala escolhe de 2 até este valor.
  LIVEKIT_ROOM_MAX_PARTICIPANTS: z.coerce.number().int().min(2).max(50).default(10),
  REDIS_URL: z.string().optional(),
  REDIS_KEY_PREFIX: z
    .string()
    .regex(/^[a-z0-9:_-]{1,40}:$/)
    .default('suburbio:site:'),
});
type Env = z.infer<typeof schema>;

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
export function isLoopback(hostname: string) {
  return LOOPBACK.has(hostname);
}
// RFC 1918/4193 hosts are reachable only inside the VPS network, never by a remote browser.
export function isPrivateHost(hostname: string) {
  if (isLoopback(hostname)) return true;
  const host = hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) === 4) return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  if (isIP(host) === 6) return /^f[cd]/i.test(host);
  return host.endsWith('.internal') || host.endsWith('.local') || !host.includes('.');
}

function parseOrigin(
  env: Env,
  key: 'AUTH_URL' | 'SUBURBIO_API_URL' | 'LIVEKIT_INTERNAL_URL' | 'LIVEKIT_PUBLIC_URL' | 'REDIS_URL',
  protocols: string[],
) {
  const value = env[key];
  if (!value) throw new Error(`Configuração ausente ou inválida: ${key}`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`URL inválida: ${key}`);
  }
  const credentialsAllowed = key === 'REDIS_URL';
  if (
    !protocols.includes(url.protocol) ||
    (!credentialsAllowed && (url.username || url.password)) ||
    url.search ||
    url.hash ||
    (key !== 'REDIS_URL' && url.pathname !== '/')
  )
    throw new Error(`Origem inválida: ${key}`);
  return url;
}

function required(env: Env, key: keyof Env, length = 1) {
  const value = env[key];
  if (typeof value !== 'string' || value.length < length) throw new Error(`Configuração ausente ou inválida: ${key}`);
}

function validateAuth(env: Env, production: boolean) {
  const url = parseOrigin(env, 'AUTH_URL', ['https:', 'http:']);
  if (production && url.protocol !== 'https:') throw new Error('HTTPS obrigatório: AUTH_URL');
  required(env, 'AUTH_SECRET', 32);
  required(env, 'DISCORD_CLIENT_SECRET', 16);
  if (!/^\d{17,20}$/.test(env.DISCORD_CLIENT_ID ?? '')) throw new Error('Configuração inválida: DISCORD_CLIENT_ID');
  if (env.DISCORD_REDIRECT_URI !== `${url.origin}/api/auth/callback/discord`)
    throw new Error('DISCORD_REDIRECT_URI deve corresponder ao callback em AUTH_URL');
  if (env.AUTH_SECRET_PREVIOUS && env.AUTH_SECRET_PREVIOUS.length < 32)
    throw new Error('Configuração inválida: AUTH_SECRET_PREVIOUS');
}

function validateApi(env: Env, production: boolean) {
  const url = parseOrigin(env, 'SUBURBIO_API_URL', ['https:', 'http:']);
  if (production && url.protocol !== 'https:' && !isPrivateHost(url.hostname))
    throw new Error('HTTPS obrigatório: SUBURBIO_API_URL');
  required(env, 'SITE_SERVICE_SECRET', 32);
}

function validateLiveKit(env: Env, production: boolean) {
  // The server SDK talks to the internal address; only the public WSS address reaches the browser.
  const internal = parseOrigin(env, 'LIVEKIT_INTERNAL_URL', ['ws:', 'wss:', 'http:', 'https:']);
  if (production && ['ws:', 'http:'].includes(internal.protocol) && !isPrivateHost(internal.hostname))
    throw new Error('TLS obrigatório: LIVEKIT_INTERNAL_URL');
  const publicUrl = parseOrigin(env, 'LIVEKIT_PUBLIC_URL', ['ws:', 'wss:']);
  if (production && (publicUrl.protocol !== 'wss:' || isPrivateHost(publicUrl.hostname)))
    throw new Error('WSS público obrigatório: LIVEKIT_PUBLIC_URL');
  required(env, 'LIVEKIT_API_KEY', 3);
  required(env, 'LIVEKIT_API_SECRET', production ? 32 : 8);
  // Salas, capacidade e permissões vivem no Redis; nunca na memória de um processo.
  if (!env.REDIS_URL) throw new Error('Configuração ausente ou inválida: REDIS_URL (exigida por LIVEKIT_ENABLED)');
}

export function parseServerEnv(raw: Record<string, string | undefined>) {
  const result = schema.safeParse(raw);
  if (!result.success)
    throw new Error(`Configuração inválida: ${result.error.issues.map((i) => i.path.join('.')).join(', ')}`);
  const env = result.data;
  const production = env.NODE_ENV === 'production';
  if (env.AUTH_ENABLED) validateAuth(env, production);
  if (env.SUBURBIO_API_ENABLED) validateApi(env, production);
  if (env.LIVEKIT_ENABLED) validateLiveKit(env, production);
  if (env.REDIS_URL) parseOrigin(env, 'REDIS_URL', ['redis:', 'rediss:']);
  return env;
}
export type ServerEnv = ReturnType<typeof parseServerEnv>;
export const serverEnv = () => parseServerEnv(process.env);
