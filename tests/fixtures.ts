import type { AdminPrincipal } from '@/lib/api/contracts';
import { parseServerEnv } from '@/lib/server/env';
export const playerId = 'c7f96a10-8207-4235-a43e-5e73cbd066a1';
export const operationId = '67b69a8c-04ca-449f-9462-dc92f6e59133';
export const discordId = '123456789012345678';
export const admin: AdminPrincipal = {
  adminAccountId: playerId,
  discordId,
  displayName: 'Administrador de teste',
  status: 'active',
  accessLevel: 'ADMIN',
  capabilities: ['ALLOWLIST_READ', 'ALLOWLIST_REVOKE', 'SERVICES_READ'],
  fullAccess: false,
  readOnly: false,
};
export const config = parseServerEnv({
  NODE_ENV: 'test',
  AUTH_ENABLED: 'true',
  SUBURBIO_API_ENABLED: 'true',
  AUTH_URL: 'http://localhost:3001',
  AUTH_SECRET: 'test-session-key-'.repeat(4),
  DISCORD_CLIENT_ID: discordId,
  DISCORD_CLIENT_SECRET: 'test-discord-secret-32-characters',
  DISCORD_REDIRECT_URI: 'http://localhost:3001/api/auth/callback/discord',
  SUBURBIO_API_URL: 'http://127.0.0.1:3000',
  SITE_SERVICE_SECRET: 'test-service-key-'.repeat(4),
  SITE_SERVICE_ID: 'site',
  SUBURBIO_API_TIMEOUT_MS: '500',
});
export const health = {
  status: 'ok',
  api: 'suburbio-api',
  postgres: 'up',
  redis: 'up',
  uptime: 120,
  version: '0.2.0',
  mysql: 'disabled',
  'discord-bot': 'unmonitored',
  'fivem-bridge': 'unmonitored',
};
