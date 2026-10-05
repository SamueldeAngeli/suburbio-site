import { it, expect, vi, beforeEach } from 'vitest';
import { config, discordId, playerId } from './fixtures';
const mocks = vi.hoisted(() => ({ resolve: vi.fn(), membership: vi.fn() }));
vi.mock('@/lib/server/env', async (original) => ({
  ...(await original<object>()),
  serverEnv: () => ({ ...config, DISCORD_ROLE_AUTH_ENABLED: true }),
}));
vi.mock('@/lib/auth/discord-membership', () => ({ currentMembership: mocks.membership }));
vi.mock('@/lib/api/client', () => ({
  SuburbioApiClient: class {
    resolveAdmin = mocks.resolve;
  },
}));
import { AccountService } from '@/lib/api/modules/accounts';
import { SiteError } from '@/lib/api/errors';
const result = (owner = false, caps = ['PLAYERS_READ']) => ({
  data: {
    adminAccountId: playerId,
    discordId,
    status: 'active',
    isSystemOwner: owner,
    capabilities: caps,
    readOnly: false,
  },
});
const proof = {
  guildId: '876948887695405066',
  status: 'VERIFIED',
  verifiedRoleIds: ['876948888085467204'],
  verifiedAt: new Date().toISOString(),
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.membership.mockResolvedValue(proof);
});
it('SYSTEM_OWNER confirmado pela API não depende do Discord', async () => {
  mocks.resolve.mockResolvedValue(result(true));
  expect((await new AccountService().resolve(discordId)).admin?.fullAccess).toBe(true);
  expect(mocks.membership).not.toHaveBeenCalled();
});
it('API indisponível não habilita fallback de cargo', async () => {
  mocks.resolve.mockRejectedValue(new SiteError('API_OFFLINE', 503));
  await expect(new AccountService().resolve(discordId)).rejects.toMatchObject({ status: 503 });
  expect(mocks.membership).not.toHaveBeenCalled();
});
it('cargos server-side enviados mas somente capabilities da API são aceitas', async () => {
  mocks.resolve.mockRejectedValueOnce(new SiteError('ADMIN_ACCESS_DENIED', 403)).mockResolvedValueOnce(result());
  const admin = (await new AccountService().resolve(discordId)).admin;
  expect(mocks.resolve).toHaveBeenLastCalledWith(discordId, proof);
  expect(admin?.capabilities).toEqual(['PLAYERS_READ']);
  expect(admin?.fullAccess).toBe(false);
});
it('Discord indisponível não aproveita capabilities de probe anterior', async () => {
  mocks.resolve.mockResolvedValue(result());
  mocks.membership.mockResolvedValue({ ...proof, status: 'UNAVAILABLE', verifiedRoleIds: [] });
  await expect(new AccountService().resolve(discordId)).rejects.toMatchObject({ code: 'DISCORD_UNAVAILABLE' });
  expect(mocks.resolve).toHaveBeenCalledTimes(2);
  expect(mocks.resolve).toHaveBeenLastCalledWith(
    discordId,
    expect.objectContaining({ status: 'UNAVAILABLE', verifiedRoleIds: [] }),
  );
});
it('cargo removido segue decisão negada da API', async () => {
  mocks.resolve.mockResolvedValueOnce(result()).mockRejectedValueOnce(new SiteError('ADMIN_ACCESS_DENIED', 403));
  mocks.membership.mockResolvedValue({ ...proof, verifiedRoleIds: [] });
  await expect(new AccountService().resolve(discordId)).rejects.toMatchObject({ status: 403 });
});
it('ação sensível exige refresh independente do TTL', async () => {
  mocks.resolve.mockResolvedValue(result());
  await new AccountService(undefined, true).resolve(discordId);
  expect(mocks.membership).toHaveBeenCalledWith(discordId, true);
});
