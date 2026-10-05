'use client';
import { useState, useRef } from 'react';
import { z } from 'zod';
import { recipientSchema, giftInput } from '@/lib/api/gift-contracts';
export type GiftSelection = z.infer<typeof giftInput>;
export function GiftRecipient({ onChange }: { onChange: (gift: GiftSelection | null) => void }) {
  const [query, setQuery] = useState(''),
    [candidate, setCandidate] = useState<z.infer<typeof recipientSchema> | null>(null),
    [anonymous, setAnonymous] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const version = useRef(0);
  async function lookup() {
    const current = ++version.current;
    setBusy(true);
    setError('');
    setConfirmed(false);
    setCandidate(null);
    onChange(null);
    try {
      const response = await fetch('/api/vip/gifts/recipient', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-suburbio-intent': 'gift.resolve' },
        body: JSON.stringify({ recipientDiscordId: query }),
      });
      const body = await response.json();
      if (current !== version.current) return;
      if (!response.ok) {
        setError(body.error?.message ?? 'Não foi possível encontrar o destinatário.');
        return;
      }
      setCandidate(recipientSchema.parse(body.data));
    } catch {
      if (current === version.current) setError('Não foi possível consultar. Tente novamente.');
    } finally {
      if (current === version.current) setBusy(false);
    }
  }
  return (
    <div className="gift-choice">
      <p>
        Presentes disponíveis para Crypto, veículos, casas, itens e serviços. VIP estará disponível após concluir a
        integração de entrega.
      </p>
      <label>
        Discord do destinatário
        <input
          value={query}
          inputMode="numeric"
          placeholder="ID da conta Discord"
          disabled={busy}
          onChange={(e) => {
            version.current++;
            setQuery(e.target.value);
            setCandidate(null);
            setConfirmed(false);
            onChange(null);
          }}
        />
      </label>
      <button type="button" className="button outline" disabled={busy || !/^\d{17,20}$/.test(query)} onClick={lookup}>
        {busy ? 'Buscando…' : 'Buscar destinatário'}
      </button>
      {candidate && (
        <div>
          <h3>Destinatário</h3>
          <p>{candidate.displayName}</p>
          <p>Discord: {candidate.discordId}</p>
          <label>
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => {
                setAnonymous(e.target.checked);
                setConfirmed(false);
                onChange(null);
              }}
            />{' '}
            Presentear anonimamente
          </label>
          <button
            type="button"
            className="button outline"
            disabled={confirmed}
            onClick={() => {
              setConfirmed(true);
              onChange({ recipientToken: candidate.recipientToken, confirmed: true, anonymousGift: anonymous });
            }}
          >
            {confirmed ? 'Destinatário confirmado' : 'Confirmar destinatário'}
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
