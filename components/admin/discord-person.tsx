import { discordAvatar } from '@/lib/public-profile';

// Pessoa do Discord numa linha de tabela: avatar, nome humano, @usuário e o ID curto (completo no título).
// O nome vem do snapshot sincronizado pelo bot; sem ele, mostra o ID e avisa.
export function DiscordPerson({
  id,
  name,
  username,
  avatar,
}: {
  id: string | null | undefined;
  name?: string | null;
  username?: string | null;
  avatar?: string | null;
}) {
  if (!id) return <span className="admin-muted">Não vinculado</span>;
  const image = discordAvatar(id, avatar ?? null);
  return (
    <span className="admin-person" title={`Discord ${id}`}>
      {image ? (
        // Avatar externo do Discord, tamanho fixo.
        <img src={image} alt="" width={28} height={28} />
      ) : (
        <span className="admin-person-initial" aria-hidden>
          {(name || '?').slice(0, 1).toUpperCase()}
        </span>
      )}
      <span>
        <strong>{name ?? 'Nome não sincronizado'}</strong>
        <small>
          {username ? `@${username} · ` : ''}ID {id.slice(0, 6)}…
        </small>
      </span>
    </span>
  );
}
