import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ session: vi.fn(), resolve: vi.fn(), affiliate: vi.fn(), log: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ currentSession: m.session }));
vi.mock('@/lib/api/modules/accounts', () => ({
  AccountService: class {
    resolve = m.resolve;
  },
}));
vi.mock('@/lib/api/client', () => ({
  SuburbioApiClient: class {
    affiliateAccess = m.affiliate;
  },
}));
vi.mock('@/lib/server/log', () => ({ logEvent: m.log }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { url });
  },
  forbidden: () => {
    throw new Error('NEXT_FORBIDDEN');
  },
}));
import { pageAccess } from '@/lib/permissions/guards';
import { GET } from '@/app/api/me/access/route';
import { SiteError } from '@/lib/api/errors';

const discordId = '403707367885242378';
const owner = {
  adminAccountId: '11111111-1111-4111-8111-111111111111',
  discordId,
  displayName: 'Administração',
  status: 'active',
  accessLevel: 'SYSTEM_OWNER',
  capabilities: ['SERVICES_READ'],
  fullAccess: true,
  readOnly: false,
};
beforeEach(() => {
  vi.clearAllMocks();
  m.session.mockResolvedValue({ user: { discordId } });
  m.affiliate.mockResolvedValue({ data: { affiliate: false } });
});
afterEach(() => vi.restoreAllMocks());

describe('acesso direto a /admin (server-side)', () => {
  it('owner provisionado na API entra', async () => {
    m.resolve.mockResolvedValue({ playerId: null, admin: owner });
    expect(await pageAccess('', '/admin')).toMatchObject({ accessLevel: 'SYSTEM_OWNER', fullAccess: true });
  });
  it('sessão ausente ou expirada volta ao login sem consultar a API', async () => {
    m.session.mockResolvedValue(null);
    await expect(pageAccess('', '/admin')).rejects.toMatchObject({ url: '/login?returnTo=%2Fadmin' });
    expect(m.resolve).not.toHaveBeenCalled();
  });
  it('usuário comum recebe 403', async () => {
    m.resolve.mockRejectedValue(new SiteError('ADMIN_ACCESS_DENIED', 403));
    await expect(pageAccess('', '/admin')).rejects.toThrow('NEXT_FORBIDDEN');
  });
  it('API fora do ar nega acesso (fail-closed)', async () => {
    m.resolve.mockRejectedValue(new SiteError('API_OFFLINE', 503));
    expect(await pageAccess('', '/admin')).toBeNull();
  });
  it('resposta da API para outra identidade é recusada', async () => {
    m.resolve.mockResolvedValue({ playerId: null, admin: { ...owner, discordId: '999999999999999999' } });
    await expect(pageAccess('', '/admin')).rejects.toThrow('NEXT_FORBIDDEN');
  });
});

describe('/api/me/access (botão do painel)', () => {
  const access = async () => (await GET(new Request('http://localhost/api/me/access'))).json();
  it('owner vê o botão', async () => {
    m.resolve.mockResolvedValue({ playerId: null, admin: owner });
    expect(await access()).toEqual({ affiliate: false, admin: true });
    expect(m.resolve).toHaveBeenCalledWith(discordId);
  });
  it('usuário comum não vê e não gera log', async () => {
    m.resolve.mockRejectedValue(new SiteError('ADMIN_ACCESS_DENIED', 403));
    expect(await access()).toEqual({ affiliate: false, admin: false });
    expect(m.log).not.toHaveBeenCalled();
  });
  it('API fora esconde o botão e registra só o código', async () => {
    m.resolve.mockRejectedValue(new SiteError('API_OFFLINE', 503));
    expect(await access()).toEqual({ affiliate: false, admin: false });
    expect(m.log).toHaveBeenCalledWith('warn', 'access.admin_unresolved', { code: 'API_OFFLINE', status: 503 });
    expect(JSON.stringify(m.log.mock.calls)).not.toContain(discordId);
  });
});
