import { it, expect, vi } from 'vitest';
import { DiscordMembership } from '@/lib/auth/discord-membership';
const id = '123456789012345678',
  guild = '876948887695405066',
  role = '876948888114839626';
it('consulta somente origem Discord fixa com bearer no servidor', async () => {
  const fetcher = vi.fn<typeof fetch>(async (url, init) => {
    expect(String(url)).toBe(`https://discord.com/api/v10/users/@me/guilds/${guild}/member`);
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-token');
    expect(init?.redirect).toBe('error');
    return Response.json({ user: { id }, roles: [role] });
  });
  const service = new DiscordMembership(fetcher);
  service.remember(id, 'test-token', Date.now() + 100000);
  const result = await service.get(id, guild, 30);
  expect(result.verifiedRoleIds).toEqual([role]);
  expect(JSON.stringify(result)).not.toContain('test-token');
});
it('cache curto evita consulta por render e expira', async () => {
  let now = 100000;
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ user: { id }, roles: [role] })),
    service = new DiscordMembership(fetcher, () => now);
  service.remember(id, 'x', 999999);
  await service.get(id, guild, 30);
  await service.get(id, guild, 30);
  expect(fetcher).toHaveBeenCalledTimes(1);
  now += 31000;
  await service.get(id, guild, 30);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('refresh obrigatório ignora cache para ação sensível', async () => {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ user: { id }, roles: [role] })),
    service = new DiscordMembership(fetcher);
  service.remember(id, 'x', Date.now() + 100000);
  await service.get(id, guild, 30);
  await service.get(id, guild, 30, true);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('remoção e adição de cargo refletem refresh sem logout', async () => {
  let roles = [role];
  const service = new DiscordMembership(async () => Response.json({ user: { id }, roles }));
  service.remember(id, 'x', Date.now() + 100000);
  expect((await service.get(id, guild, 30)).verifiedRoleIds).toEqual([role]);
  roles = [];
  expect((await service.get(id, guild, 30, true)).verifiedRoleIds).toEqual([]);
  roles = [role];
  expect((await service.get(id, guild, 30, true)).verifiedRoleIds).toEqual([role]);
});
it('ausência de membership é distinta de indisponibilidade', async () => {
  for (const [code, status] of [
    [404, 'NO_MEMBER'],
    [429, 'UNAVAILABLE'],
    [503, 'UNAVAILABLE'],
    [401, 'UNAVAILABLE'],
  ] as const) {
    const service = new DiscordMembership(async () => new Response('', { status: code }));
    service.remember(id, 'x', Date.now() + 100000);
    expect((await service.get(id, guild, 30)).status).toBe(status);
  }
});
it('identidade diferente não concede cargos', async () => {
  const service = new DiscordMembership(async () => Response.json({ user: { id: guild }, roles: [role] }));
  service.remember(id, 'x', Date.now() + 100000);
  expect((await service.get(id, guild, 30)).status).toBe('UNAVAILABLE');
});
it('nomes e IDs inválidos não viram roles', async () => {
  const service = new DiscordMembership(async () => Response.json({ user: { id }, roles: ['OWNER', '0', role, role] }));
  service.remember(id, 'x', Date.now() + 100000);
  expect((await service.get(id, guild, 30)).verifiedRoleIds).toEqual([role]);
});
it('token ausente ou expirado falha sem transporte', async () => {
  const fetcher = vi.fn(),
    service = new DiscordMembership(fetcher);
  expect((await service.get(id, guild, 30)).status).toBe('UNAVAILABLE');
  service.remember(id, 'x', 1);
  expect((await service.get(id, guild, 30)).status).toBe('UNAVAILABLE');
  expect(fetcher).not.toHaveBeenCalled();
});
it('logout remove token e cache server-side', async () => {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ user: { id }, roles: [role] })),
    service = new DiscordMembership(fetcher);
  service.remember(id, 'x', Date.now() + 100000);
  await service.get(id, guild, 30);
  service.forget(id);
  expect((await service.get(id, guild, 30)).status).toBe('UNAVAILABLE');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('falha de refresh não recupera autorização do cache anterior', async () => {
  const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ user: { id }, roles: [role] }))
      .mockRejectedValue(Error('network')),
    service = new DiscordMembership(fetcher);
  service.remember(id, 'x', Date.now() + 100000);
  await service.get(id, guild, 30);
  expect((await service.get(id, guild, 30, true)).status).toBe('UNAVAILABLE');
  expect((await service.get(id, guild, 30)).status).toBe('UNAVAILABLE');
});
it('resposta pendente após logout não é reutilizada', async () => {
  let finish!: (r: Response) => void;
  const service = new DiscordMembership(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  service.remember(id, 'x', Date.now() + 100000);
  const pending = service.get(id, guild, 30);
  service.forget(id);
  finish(Response.json({ user: { id }, roles: [role] }));
  expect((await pending).status).toBe('UNAVAILABLE');
});
