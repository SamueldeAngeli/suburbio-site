import { describe, it, expect, vi, afterEach } from 'vitest';
import { SuburbioApiClient, classifyFailure } from '@/lib/api/client';
import { safeError } from '@/lib/api/errors';
import { config, discordId } from './fixtures';

const apiError = (status: number, code: string) => async () =>
  Response.json({ error: { code, message: 'detalhe interno' } }, { status });
type Case = [string, typeof fetch, string, string];
const cases: Case[] = [
  ['invalid HMAC', apiError(401, 'SERVICE_UNAUTHORIZED'), 'invalid_hmac', 'API_OFFLINE'],
  ['replay', apiError(401, 'SERVICE_REPLAY'), 'invalid_hmac', 'API_OFFLINE'],
  ['service forbidden', apiError(403, 'SERVICE_FORBIDDEN'), 'forbidden', 'API_OFFLINE'],
  ['admin forbidden', apiError(403, 'ADMIN_ACCESS_DENIED'), 'forbidden', 'ADMIN_ACCESS_DENIED'],
  ['dependency down', apiError(503, 'DEPENDENCY_UNAVAILABLE'), 'api_unavailable', 'API_OFFLINE'],
  ['internal error', apiError(500, 'INTERNAL_ERROR'), 'internal_api_error', 'API_OFFLINE'],
  ['malformed body', async () => new Response('<html>', { status: 200 }), 'malformed_response', 'API_INVALID_RESPONSE'],
  ['wrong shape', async () => Response.json({ unexpected: true }), 'malformed_response', 'API_INVALID_RESPONSE'],
  [
    'timeout',
    async () => {
      throw Object.assign(new Error('aborted'), { name: 'TimeoutError' });
    },
    'api_timeout',
    'API_OFFLINE',
  ],
  [
    'network down',
    async () => {
      throw new TypeError('fetch failed: connect ECONNREFUSED 10.0.0.2');
    },
    'api_unavailable',
    'API_OFFLINE',
  ],
];

afterEach(() => vi.restoreAllMocks());

describe('Diagnóstico interno de falhas da API', () => {
  it.each(cases)('%s → log %s, navegador vê só %s', async (_name, transport, outcome, code) => {
    const lines: string[] = [];
    vi.spyOn(console, 'warn').mockImplementation((line) => {
      lines.push(String(line));
    });
    const error = await new SuburbioApiClient(config, transport).resolveAdmin(discordId).catch((e) => e);
    expect(error).toMatchObject({ code });
    const log = JSON.parse(lines.at(-1)!);
    expect(log).toMatchObject({
      service: 'site',
      event: 'api.request',
      target: 'suburbio-api',
      outcome,
      operation: 'POST /internal/site/admin/resolve',
    });
    expect(typeof log.durationMs).toBe('number');
    expect(log.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    const external = JSON.stringify(safeError(error));
    expect(external).not.toMatch(/invalid_hmac|SERVICE_|ECONNREFUSED|detalhe interno|10\.0\.0\.2/);
  });

  it('logs never contain the service secret, signature or discord id', async () => {
    const lines: string[] = [];
    vi.spyOn(console, 'info').mockImplementation((line) => {
      lines.push(String(line));
    });
    vi.spyOn(console, 'warn').mockImplementation((line) => {
      lines.push(String(line));
    });
    await new SuburbioApiClient(config, apiError(401, 'SERVICE_UNAUTHORIZED')).entitlements(discordId).catch(() => {});
    const text = lines.join('\n');
    expect(text).not.toContain(config.SITE_SERVICE_SECRET!);
    expect(text).not.toContain(discordId);
    expect(text).not.toMatch(/[a-f0-9]{64}/);
  });

  it('classifies plain 401/403 without service codes', () => {
    expect(classifyFailure(401, '')).toBe('unauthorized');
    expect(classifyFailure(403, '')).toBe('forbidden');
    expect(classifyFailure(409, 'REVISION_CONFLICT')).toBe('rejected');
  });
});
