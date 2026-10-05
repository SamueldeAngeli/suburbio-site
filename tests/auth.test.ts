import { describe, it, expect, vi } from 'vitest';
import { encode, decode } from 'next-auth/jwt';
import { can, assertCapability } from '@/lib/permissions/policy';
import { createAuthConfig } from '@/lib/auth/config';
import { AllowlistService } from '@/lib/api/modules/allowlist';
import { SuburbioApiClient } from '@/lib/api/client';
import { admin, config, discordId, playerId, operationId } from './fixtures';
vi.mock('@/lib/auth/session', () => ({ currentSession: vi.fn(async () => null) }));
import { authorize } from '@/lib/permissions/guards';
describe('Autorização institucional', () => {
  it('sem sessão não consulta API e bloqueia', async () => {
    const resolver = { resolve: vi.fn() };
    await expect(authorize(null, 'SERVICES_READ', resolver)).rejects.toMatchObject({ status: 401 });
    expect(resolver.resolve).not.toHaveBeenCalled();
  });
  it('sessão comum sem AdminAccount recebe 403', async () =>
    await expect(
      authorize(discordId, 'SERVICES_READ', { resolve: async () => ({ admin: null, playerId }) }),
    ).rejects.toMatchObject({ status: 403 }));
  it('capability concedida permite acesso', async () =>
    expect(await authorize(discordId, 'SERVICES_READ', { resolve: async () => ({ admin, playerId: null }) })).toBe(
      admin,
    ));
  it('capability ausente recebe 403', () => expect(() => assertCapability(admin, 'PAYMENTS_READ')).toThrow());
  it('SYSTEM_OWNER só recebe acesso completo por decisão explícita da API', () => {
    expect(can({ ...admin, accessLevel: 'SYSTEM_OWNER', fullAccess: true }, 'PAYMENTS_READ')).toBe(true);
    expect(can({ ...admin, accessLevel: 'SYSTEM_OWNER', fullAccess: false }, 'PAYMENTS_READ')).toBe(false);
  });
  it('owner desabilitado não tem acesso', () =>
    expect(can({ ...admin, accessLevel: 'SYSTEM_OWNER', fullAccess: true, status: 'disabled' }, 'SERVICES_READ')).toBe(
      false,
    ));
  it('Discord resolvido diferente da sessão não é aceito', async () =>
    await expect(
      authorize('999999999999999999', 'SERVICES_READ', { resolve: async () => ({ admin, playerId: null }) }),
    ).rejects.toMatchObject({ status: 403 }));
  it('revoke deriva ator exclusivamente da sessão autorizada', async () => {
    const transport = vi.fn<typeof fetch>(async (_, init) => {
      expect(JSON.parse(String(init?.body)).actorDiscordId).toBe(discordId);
      return Response.json({ playerId, allowlistId: playerId, status: 'revoked', operationId });
    });
    const svc = new AllowlistService(new SuburbioApiClient(config, transport));
    await svc.revoke({ playerId, reason: 'Motivo de teste', confirmed: true, idempotencyKey: 'test-operation' }, admin);
  });
  it('browser não pode injetar actorDiscordId', () => {
    const svc = new AllowlistService();
    expect(() =>
      svc.revoke(
        {
          playerId,
          reason: 'Motivo',
          confirmed: true,
          idempotencyKey: 'test-operation',
          actorDiscordId: '999999999999999999',
        },
        admin,
      ),
    ).toThrow();
  });
  it('revoke exige confirmação e motivo', () =>
    expect(() =>
      new AllowlistService().revoke(
        { playerId, reason: 'x', confirmed: false, idempotencyKey: 'test-operation' },
        admin,
      ),
    ).toThrow());
  it('read-only bloqueia revoke antes do transporte', () =>
    expect(() => new AllowlistService().revoke({}, { ...admin, readOnly: true })).toThrow(
      expect.objectContaining({ code: 'API_READ_ONLY' }),
    ));
});
describe('Discord e sessão Auth.js', () => {
  const authConfig = createAuthConfig(config);
  it('usa sessão expiráveis, cookies seguros em produção e identificação mínima', () => {
    expect(authConfig.session).toMatchObject({ strategy: 'jwt', maxAge: 3600 });
    expect(
      createAuthConfig({ ...config, NODE_ENV: 'production', AUTH_URL: 'https://site.example' }).useSecureCookies,
    ).toBe(true);
    const provider = authConfig.providers[0] as {
      options: { authorization: { params: { scope: string } }; checks: string[] };
    };
    expect(provider.options.authorization.params.scope).toBe('identify guilds.members.read');
    expect(provider.options.checks).toEqual(['state']);
  });
  it('login valida Discord ID obtido do provider', async () => {
    const signIn = authConfig.callbacks!.signIn!;
    expect(
      await signIn({ account: { provider: 'discord' }, profile: { id: discordId } } as Parameters<typeof signIn>[0]),
    ).toBe(true);
    expect(
      await signIn({ account: { provider: 'discord' }, profile: { id: 'evil' } } as Parameters<typeof signIn>[0]),
    ).toBe(false);
  });
  it('update do navegador não altera identidade do token', async () => {
    const jwt = authConfig.callbacks!.jwt!;
    const result = await jwt({
      token: { discordId, authenticatedAt: Date.now() },
      trigger: 'update',
      session: { discordId: '999999999999999999', fullAccess: true },
    } as unknown as Parameters<typeof jwt>[0]);
    expect(result?.discordId).toBe(discordId);
    expect(result).not.toHaveProperty('fullAccess');
  });
  it('sessão acima do limite absoluto é invalidada', async () => {
    const jwt = authConfig.callbacks!.jwt!;
    expect(
      await jwt({ token: { discordId, authenticatedAt: Date.now() - 9 * 3600_000 } } as unknown as Parameters<
        typeof jwt
      >[0]),
    ).toBeNull();
  });
  it('retorno de sessão não contém tokens, email ou capabilities', async () => {
    const session = authConfig.callbacks!.session!;
    const value = await session({
      session: { expires: '2030-01-01', user: { name: 'Teste', email: 'hidden@example.test' } },
      token: { discordId, access_token: 'secret', capabilities: ['ADMIN'] },
    } as unknown as Parameters<typeof session>[0]);
    expect(value).toEqual({ expires: '2030-01-01', user: { name: 'Teste', discordId } });
  });
  it('bloqueia redirects externos', async () => {
    const redirect = authConfig.callbacks!.redirect!;
    expect(await redirect({ url: 'https://evil.example/', baseUrl: 'https://untrusted.example' })).toBe(
      'http://localhost:3001/minha-conta',
    );
  });
  it('sessão é criptografada e pode ser validada com chave atual', async () => {
    const token = await encode({ token: { discordId }, secret: config.AUTH_SECRET!, salt: 'test', maxAge: 3600 });
    expect(token).not.toContain(discordId);
    expect((await decode({ token, secret: config.AUTH_SECRET!, salt: 'test' }))?.discordId).toBe(discordId);
  });
  it('sessão adulterada é rejeitada', async () => {
    const token = await encode({ token: { discordId }, secret: config.AUTH_SECRET!, salt: 'test' });
    const parts = token.split('.');
    parts[3] = (parts[3][0] === 'A' ? 'B' : 'A') + parts[3].slice(1);
    await expect(decode({ token: parts.join('.'), secret: config.AUTH_SECRET!, salt: 'test' })).rejects.toThrow();
  });
  it('rotação permite chave anterior e recusa chave desconhecida', async () => {
    const old = 'old-test-secret'.repeat(4);
    const token = await encode({ token: { discordId }, secret: old, salt: 'test' });
    expect((await decode({ token, secret: [config.AUTH_SECRET!, old], salt: 'test' }))?.discordId).toBe(discordId);
    await expect(decode({ token, secret: config.AUTH_SECRET!, salt: 'test' })).rejects.toThrow();
  });
});
