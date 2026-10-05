import { it, expect } from 'vitest';
import { discordAvatar, safeAvatar, publicProfile } from '@/lib/public-profile';
import { createAuthConfig } from '@/lib/auth/config';
import { config, discordId } from './fixtures';
it('avatar só aceita ID e hash Discord válidos', () => {
  expect(discordAvatar(discordId, '1234567890abcdef1234567890abcdef')).toContain('https://cdn.discordapp.com/avatars/');
  expect(discordAvatar('evil', 'hash')).toBeNull();
  expect(safeAvatar('https://evil.example/a.png')).toBeNull();
});
it('perfil público contém somente informações de apresentação', () => {
  expect(
    publicProfile({ name: 'Tec', username: 'tec', discordId, access_token: 'hidden', capabilities: ['ADMIN'] }),
  ).toEqual({ name: 'Tec', username: 'tec', image: null });
});
it('sessão conserva avatar e username sem expor token ou mudar permissões', async () => {
  const auth = createAuthConfig(config),
    image = discordAvatar(discordId, '1234567890abcdef1234567890abcdef');
  const session = auth.callbacks!.session!;
  const value = await session({
    session: { expires: '2030-01-01', user: { name: 'Tec' } },
    token: { discordId, picture: image, username: 'tec', access_token: 'hidden' },
  } as unknown as Parameters<typeof session>[0]);
  expect(value.user).toEqual({ name: 'Tec', discordId, image, username: 'tec' });
  expect(value).not.toHaveProperty('access_token');
});
