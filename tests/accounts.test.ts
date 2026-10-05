import { describe, it, expect, vi } from 'vitest';
import { AccountService } from '@/lib/api/modules/accounts';
import { SuburbioApiClient } from '@/lib/api/client';
import { config, discordId, playerId } from './fixtures';
const resolved = {
  adminAccountId: playerId,
  discordId,
  status: 'active',
  isSystemOwner: true,
  capabilities: ['ADMINS_READ'],
  readOnly: false,
};
describe('Contrato administrativo v0.3', () => {
  it('resolve owner pela API sem depender de personagem', async () => {
    const transport = vi.fn<typeof fetch>(async (url, init) => {
      expect(new URL(String(url)).pathname).toBe('/internal/site/admin/resolve');
      expect(JSON.parse(String(init?.body))).toEqual({ discordId });
      expect(init?.headers).toHaveProperty('X-Signature');
      return Response.json(resolved);
    });
    const result = await new AccountService(new SuburbioApiClient(config, transport)).resolve(discordId);
    expect(result).toMatchObject({
      playerId: null,
      admin: { fullAccess: true, accessLevel: 'SYSTEM_OWNER', capabilities: ['ADMINS_READ'] },
    });
  });
  it('admin comum mantém somente capabilities retornadas', async () => {
    const transport = vi.fn<typeof fetch>(async () => Response.json({ ...resolved, isSystemOwner: false }));
    expect((await new AccountService(new SuburbioApiClient(config, transport)).resolve(discordId)).admin).toMatchObject(
      { fullAccess: false, accessLevel: 'STANDARD' },
    );
  });
  it('recusa resposta de outra identidade', async () => {
    const transport = vi.fn<typeof fetch>(async () => Response.json({ ...resolved, discordId: '999999999999999999' }));
    await expect(new AccountService(new SuburbioApiClient(config, transport)).resolve(discordId)).rejects.toMatchObject(
      { status: 403 },
    );
  });
  it('nega não administrador sem fallback', async () => {
    const transport = vi.fn<typeof fetch>(async () =>
      Response.json({ error: { code: 'ADMIN_ACCESS_DENIED' } }, { status: 403 }),
    );
    await expect(new AccountService(new SuburbioApiClient(config, transport)).resolve(discordId)).rejects.toMatchObject(
      { code: 'ADMIN_ACCESS_DENIED', status: 403 },
    );
  });
  it('recusa resposta sem decisão explícita de owner', async () => {
    const transport = vi.fn<typeof fetch>(async () =>
      Response.json({ adminAccountId: playerId, discordId, status: 'active', capabilities: ['ADMINS_READ'] }),
    );
    await expect(new AccountService(new SuburbioApiClient(config, transport)).resolve(discordId)).rejects.toMatchObject(
      { code: 'API_INVALID_RESPONSE' },
    );
  });
  it('preserva modo somente leitura', async () => {
    const transport = vi.fn<typeof fetch>(async () => Response.json({ ...resolved, readOnly: true }));
    expect(
      (await new AccountService(new SuburbioApiClient(config, transport)).resolve(discordId)).admin?.readOnly,
    ).toBe(true);
  });
  it('lista com ator da sessão no caminho assinado', async () => {
    const transport = vi.fn<typeof fetch>(async (url) => {
      const query = new URL(String(url)).searchParams;
      expect(query.get('actorDiscordId')).toBe(discordId);
      expect(query.get('page')).toBe('2');
      return Response.json({ items: [], page: 2, pageSize: 25, total: 0 });
    });
    expect((await new SuburbioApiClient(config, transport).admins(discordId, 2)).data.items).toEqual([]);
  });
});
