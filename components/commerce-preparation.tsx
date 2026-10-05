'use client';
import { useState } from 'react';
import type { RecipientView, RenewalView, SlotsView, VipQueueView, RefundView } from '@/lib/commerce-preparation';
import { refundLabels } from '@/lib/commerce-preparation';
export function GiftChoice({
  value,
  onChange,
}: {
  value: 'self' | 'gift';
  onChange: (value: 'self' | 'gift') => void;
}) {
  return (
    <fieldset className="gift-choice">
      <legend>Para quem é esta compra?</legend>
      <label>
        <input type="radio" name="recipient-mode" checked={value === 'self'} onChange={() => onChange('self')} /> Para
        mim
      </label>
      <label>
        <input type="radio" name="recipient-mode" checked={value === 'gift'} onChange={() => onChange('gift')} />{' '}
        Presentear outra pessoa
      </label>
    </fieldset>
  );
}
export function RecipientConfirmation({ recipient }: { recipient: RecipientView | null }) {
  return (
    <div>
      <h3>Destinatário</h3>
      {recipient ? (
        <p>
          {recipient.name} · {recipient.discord}
          {recipient.passport ? ` · Passaporte ${recipient.passport}` : ''}
        </p>
      ) : (
        <p>Nenhum destinatário confirmado.</p>
      )}
      <button type="button" className="button outline" disabled>
        Confirmar destinatário
      </button>
    </div>
  );
}
export function RenewalPreparation({
  entitlementId,
  data = null,
}: {
  entitlementId: string;
  data?: RenewalView | null;
}) {
  const [open, setOpen] = useState(false),
    [option, setOption] = useState('');
  return (
    <div>
      <button type="button" className="button outline small" aria-expanded={open} onClick={() => setOpen(!open)}>
        Renovar
      </button>
      {open && <RenewalOptions entitlementId={entitlementId} data={data} option={option} onChange={setOption} />}
    </div>
  );
}
export function RenewalOptions({
  entitlementId,
  data,
  option = '',
  onChange = () => {},
}: {
  entitlementId: string;
  data: RenewalView | null;
  option?: string;
  onChange?: (id: string) => void;
}) {
  const matching = data?.entitlementId === entitlementId ? data : null;
  return (
    <div className="renewal-options">
      <h3>Renovar este benefício</h3>
      <p>Renovação indisponível no momento. Nenhum benefício será duplicado ou alterado.</p>
      {matching?.options.length ? (
        <label>
          Escolha o período
          <select value={option} onChange={(e) => onChange(e.target.value)}>
            <option value="">Selecione</option>
            {matching.options.map((o) => (
              <option value={o.id} key={o.id}>
                {o.days} dias ·{' '}
                {(o.amountMinor / 100).toLocaleString('pt-BR', { style: 'currency', currency: o.currency })}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p>Os períodos e valores ainda não estão disponíveis.</p>
      )}
      <button className="button" disabled>
        Continuar para pagamento
      </button>
    </div>
  );
}
export function SlotsSummary({ data = null, recipient = false }: { data?: SlotsView | null; recipient?: boolean }) {
  return (
    <section className="citizen-slots">
      <h2>{recipient ? 'Personagens do destinatário' : 'Slots de personagem'}</h2>
      {data ? (
        <>
          <div className="citizen-slots-dots" aria-hidden="true">
            {Array.from({ length: data.maximum }, (_, i) => (
              <i key={i} className={i < data.effectiveCharacterSlots ? 'filled' : ''} />
            ))}
          </div>
          <p>
            {data.effectiveCharacterSlots} / {data.maximum} slots disponibilizados
          </p>
          <p>
            {!data.purchaseAllowed
              ? `${recipient ? 'O destinatário' : 'Você'} já atingiu o limite máximo de ${data.maximum} personagens.`
              : `Quantidade disponível para aquisição: ${data.availableQuantity}`}
          </p>
          {data.purchaseAllowed && (
            <button className="button outline small" disabled>
              Compra indisponível
            </button>
          )}
        </>
      ) : (
        <p>A sincronização dos slots ainda não está disponível.</p>
      )}
    </section>
  );
}
export function VipQueue({ data = null }: { data?: VipQueueView | null }) {
  return (
    <section className="admin-panel">
      <h2>VIP atual e próximos VIPs</h2>
      {data ? (
        <>
          <h3>Atual</h3>
          <p>{data.current ? `${data.current.name} · ${data.current.remaining}` : 'Nenhum VIP atual informado.'}</p>
          <h3>Próximos</h3>
          {data.next.map((v) => (
            <p key={v.id}>
              {v.name} · {v.duration}
            </p>
          ))}
        </>
      ) : (
        <p>A sequência dos seus VIPs ainda não está disponível. Consulte abaixo os benefícios já registrados.</p>
      )}
    </section>
  );
}
export function RefundState({ data }: { data: RefundView | null }) {
  return (
    <section className="admin-panel">
      <h2>Estorno</h2>
      {data ? (
        <>
          <p>{refundLabels[data.status]}</p>
          {data.reason === 'slot_limit' && (
            <p>Não foi possível entregar o slot porque a conta atingiu o limite máximo.</p>
          )}
        </>
      ) : (
        <p>Informações de estorno ainda não disponíveis.</p>
      )}
    </section>
  );
}
