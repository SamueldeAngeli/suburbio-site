import { Car, Home, Users } from 'lucide-react';
import type { Character } from '@/lib/api/citizen-contracts';

// Dados vêm do QBCore via API. null = indisponível: mostrado como tal, nunca como zero ou lista vazia.
const UNAVAILABLE = 'Indisponível';
const money = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
const fullName = (c: Character) => [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Nome não informado';
// qb-garages: 0 out, 1 garaged, 2 impound. Qualquer outro valor chega como UNKNOWN.
const vehicleState = {
  OUT: 'Fora da garagem',
  GARAGED: 'Na garagem',
  IMPOUNDED: 'Apreendido',
  UNKNOWN: 'Estado indisponível',
};
const role = (r: { label: string; grade: string | null }) => (r.grade ? `${r.label} · ${r.grade}` : r.label);

export function CharacterCards({ items }: { items: Character[] }) {
  return (
    <div className="citizen-characters">
      {items.map((c) => (
        <article key={c.citizenId}>
          <Users size={25} />
          <h3>{fullName(c)}</h3>
          <p>Passaporte {c.citizenId}</p>
          {c.job && <p>{role(c.job)}</p>}
        </article>
      ))}
    </div>
  );
}

export function CharacterDetails({ items }: { items: Character[] }) {
  return (
    <div className="citizen-characters citizen-character-details">
      {items.map((c) => (
        <article key={c.citizenId}>
          <Users size={25} />
          <h3>{fullName(c)}</h3>
          <dl>
            <dt>Passaporte</dt>
            <dd>{c.citizenId}</dd>
            {c.slot !== null && (
              <>
                <dt>Slot</dt>
                <dd>{c.slot}</dd>
              </>
            )}
            <dt>Emprego</dt>
            <dd>{c.job ? role(c.job) : UNAVAILABLE}</dd>
            <dt>Organização</dt>
            <dd>{c.gang ? role(c.gang) : 'Nenhuma'}</dd>
            <dt>Telefone</dt>
            <dd>{c.phone ?? UNAVAILABLE}</dd>
            <dt>Em mãos</dt>
            <dd>{c.money ? money(c.money.cash) : UNAVAILABLE}</dd>
            <dt>Banco</dt>
            <dd>{c.money ? money(c.money.bank) : UNAVAILABLE}</dd>
          </dl>
          <h4>
            <Car size={16} /> Veículos
          </h4>
          {c.vehicles === null ? (
            <p>Veículos indisponíveis no momento.</p>
          ) : c.vehicles.length ? (
            <ul>
              {c.vehicles.map((v, i) => (
                <li key={`${v.plate}-${i}`}>
                  <strong>{v.plate}</strong> {v.model ?? 'Modelo não informado'} · {vehicleState[v.state]}
                </li>
              ))}
            </ul>
          ) : (
            <p>Nenhum veículo.</p>
          )}
          <h4>
            <Home size={16} /> Propriedades
          </h4>
          {c.properties === null ? (
            <p>Propriedades indisponíveis no momento.</p>
          ) : c.properties.length ? (
            <ul>
              {c.properties.map((p, i) => (
                <li key={`${p.type}-${p.name}-${i}`}>
                  {p.type === 'HOUSE' ? 'Casa' : 'Apartamento'}: {p.name}
                </li>
              ))}
            </ul>
          ) : (
            <p>Nenhuma propriedade.</p>
          )}
        </article>
      ))}
    </div>
  );
}

// Personagens na cidade + limite configurado no servidor (qb-multicharacter). Não é compra nem
// concessão individual de slots.
export function CharacterSlots({ used, configured }: { used: number | null; configured: number | null | undefined }) {
  return (
    <section className="citizen-slots">
      <h2>Slots de personagem</h2>
      {used !== null && configured ? (
        <>
          <div className="citizen-slots-dots" aria-hidden="true">
            {Array.from({ length: Math.min(Math.max(configured, used), 20) }, (_, i) => (
              <i key={i} className={i < used ? 'filled' : ''} />
            ))}
          </div>
          <p>
            {used} de {configured} slots configurados no servidor
          </p>
        </>
      ) : (
        <p>Quantidade de slots indisponível no momento.</p>
      )}
    </section>
  );
}
