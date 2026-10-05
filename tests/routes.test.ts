import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SiteError } from '@/lib/api/errors';
import { config, admin, playerId, operationId } from './fixtures';
const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), health: vi.fn(), revoke: vi.fn(), get: vi.fn() }));
vi.mock('@/lib/permissions/guards', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('@/lib/server/env', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  serverEnv: () => config,
}));
vi.mock('@/lib/api/client', () => ({
  SuburbioApiClient: class {
    health = mocks.health;
  },
}));
vi.mock('@/lib/api/modules/allowlist', () => ({
  AllowlistService: class {
    revoke = mocks.revoke;
    get = mocks.get;
  },
}));
import { GET as services } from '@/app/api/admin/services/route';
import { GET as allowlist } from '@/app/api/admin/allowlist/[playerId]/route';
import { POST as revoke } from '@/app/api/admin/allowlist/revoke/route';
beforeEach(() => {
  mocks.requireAdmin.mockReset();
  mocks.health.mockReset();
  mocks.revoke.mockReset();
  mocks.get.mockReset();
});
describe('BFF protege cada route handler', () => {
  it('services sem sessão retorna 401 e não consulta health', async () => {
    mocks.requireAdmin.mockRejectedValue(new SiteError('SESSION_REQUIRED', 401));
    const response = await services();
    expect(response.status).toBe(401);
    expect(mocks.health).not.toHaveBeenCalled();
  });
  it('services sem capability retorna 403', async () => {
    mocks.requireAdmin.mockRejectedValue(new SiteError('ADMIN_CAPABILITY_REQUIRED', 403));
    expect((await services()).status).toBe(403);
  });
  it('services retorna dados reais do adapter sem cache', async () => {
    mocks.requireAdmin.mockResolvedValue(admin);
    mocks.health.mockResolvedValue({ data: { status: 'ok' } });
    const r = await services();
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toContain('no-store');
    expect(mocks.requireAdmin).toHaveBeenCalledWith('SERVICES_READ');
  });
  it('allowlist exige capability em acesso direto', async () => {
    mocks.requireAdmin.mockRejectedValue(new SiteError('ADMIN_CAPABILITY_REQUIRED', 403));
    expect((await allowlist(new Request('http://localhost'), { params: Promise.resolve({ playerId }) })).status).toBe(
      403,
    );
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it('revoke rejeita CSRF antes de consultar sessão ou API', async () => {
    const r = await revoke(
      new Request('http://localhost', { method: 'POST', headers: { Origin: 'https://evil.example' } }),
    );
    expect(r.status).toBe(403);
    expect(mocks.requireAdmin).not.toHaveBeenCalled();
    expect(mocks.revoke).not.toHaveBeenCalled();
  });
  it('revoke exige intenção explícita', async () => {
    const r = await revoke(new Request('http://localhost', { method: 'POST', headers: { Origin: config.AUTH_URL! } }));
    expect(r.status).toBe(400);
  });
  it('revoke usa principal autenticado e responde operação', async () => {
    mocks.requireAdmin.mockResolvedValue(admin);
    mocks.revoke.mockResolvedValue({ data: { operationId }, trace: { operationId } });
    const r = await revoke(
      new Request('http://localhost', {
        method: 'POST',
        headers: {
          Origin: config.AUTH_URL!,
          'X-Suburbio-Intent': 'allowlist.revoke',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playerId, reason: 'Motivo', confirmed: true, idempotencyKey: 'test-idempotency' }),
      }),
    );
    expect(r.status).toBe(200);
    expect(mocks.revoke.mock.calls[0][1]).toBe(admin);
    expect(mocks.requireAdmin).toHaveBeenCalledWith('ALLOWLIST_REVOKE');
  });
  it('gap de autorização retorna 503 e não chama adapter', async () => {
    mocks.requireAdmin.mockRejectedValue(new SiteError('API_GAP'));
    expect((await services()).status).toBe(503);
    expect(mocks.health).not.toHaveBeenCalled();
  });
});
