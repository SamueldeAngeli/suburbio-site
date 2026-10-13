import { discordAvatar } from '@/lib/public-profile';
import type { DiscordIdentity } from '@/lib/api/player-profile-contracts';

// Nome humano do Discord (snapshot da API): display name → apelido → username; ID só como último recurso.
export const shortDiscordId = (id: string) => `${id.slice(0, 6)}…`;
export function discordLabel(id: string, name: string | null) {
  return name ?? `ID ${shortDiscordId(id)}`;
}
export function DiscordIdentityCard({ identity }: { identity: DiscordIdentity | null }) {
  if (!identity) return <p>Discord não vinculado.</p>;
  const avatar = discordAvatar(identity.discordId, identity.avatarHash);
  return (
    <div className="admin-discord-identity">
      {avatar && <img src={avatar} alt="" width={40} height={40} />}
      <div>
        <strong>
          {discordLabel(identity.discordId, identity.displayName ?? identity.username ?? identity.guildNickname)}
        </strong>
        {identity.guildNickname && identity.guildNickname !== identity.displayName && (
          <small>Apelido no Subúrbio: {identity.guildNickname}</small>
        )}
        {identity.username && <small>@{identity.username}</small>}
        <small title={identity.discordId}>ID: {shortDiscordId(identity.discordId)}</small>
        {!identity.observedAt && <small>Nome ainda não sincronizado pelo bot.</small>}
      </div>
    </div>
  );
}
