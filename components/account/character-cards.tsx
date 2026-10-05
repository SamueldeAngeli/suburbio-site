import { Users } from 'lucide-react';
import type { z } from 'zod';
import type { charactersSchema } from '@/lib/api/citizen-contracts';
export function CharacterCards({ items }: { items: z.infer<typeof charactersSchema>['items'] }) {
  return (
    <div className="citizen-characters">
      {items.map((c) => (
        <article key={c.citizenId}>
          <Users size={25} />
          <h3>{[c.firstName, c.lastName].filter(Boolean).join(' ') || 'Nome não informado'}</h3>
          <p>Passaporte {c.citizenId}</p>
        </article>
      ))}
    </div>
  );
}
