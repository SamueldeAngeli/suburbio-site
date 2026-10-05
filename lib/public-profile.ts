export type PublicProfile = { name: string; image?: string | null; username?: string | null };
export function discordAvatar(id: unknown, hash: unknown): string | null {
  if (
    typeof id !== 'string' ||
    !/^\d{17,20}$/.test(id) ||
    typeof hash !== 'string' ||
    !/^(a_)?[a-f0-9]{32}$/.test(hash)
  )
    return null;
  return `https://cdn.discordapp.com/avatars/${id}/${hash}.png?size=128`;
}
export function safeAvatar(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.origin === 'https://cdn.discordapp.com' &&
      /^\/avatars\/\d{17,20}\/(a_)?[a-f0-9]{32}\.png$/.test(url.pathname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function publicProfile(value: unknown): PublicProfile | null {
  if (!value || typeof value !== 'object' || !('name' in value)) return null;
  const user = value as { name?: unknown; image?: unknown; username?: unknown };
  return {
    name: typeof user.name === 'string' && user.name.trim() ? user.name : 'Cidadão',
    image: safeAvatar(user.image),
    username: typeof user.username === 'string' ? user.username.slice(0, 100) : null,
  };
}
