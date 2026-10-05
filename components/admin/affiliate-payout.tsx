'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { moneyMinor } from '@/lib/format-money';
export function AffiliatePayout({
  id,
  preview,
}: {
  id: string;
  preview: { orderIds: string[]; grossMinor: string; offsetMinor: string; amountMinor: string };
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    key = useRef(''),
    last = useRef('');
  const router = useRouter();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget),
      data = {
        orderIds: preview.orderIds,
        expectedAmountMinor: preview.amountMinor,
        note: String(f.get('note')),
        confirm: f.has('confirm'),
      },
      raw = JSON.stringify(data);
    if (raw !== last.current) {
      last.current = raw;
      key.current = crypto.randomUUID();
    }
    setBusy(true);
    try {
      const r = await fetch('/api/admin/affiliates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-suburbio-intent': 'affiliate.write' },
          body: JSON.stringify({ action: 'payout', id, data, idempotencyKey: key.current }),
        }),
        body = await r.json();
      if (!r.ok) {
        setMessage(body.error?.message ?? 'Não foi possível registrar.');
        return;
      }
      setMessage('Repasse registrado.');
      router.refresh();
    } catch {
      setMessage('Conexão interrompida. Tente novamente com os mesmos dados.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="affiliate-payout-box" onSubmit={submit}>
      <h2>Registrar repasse manual</h2>
      <p>
        {preview.orderIds.length} comissões disponíveis · Bruto: {moneyMinor(preview.grossMinor)} · Compensações:{' '}
        {moneyMinor(preview.offsetMinor)}
      </p>
      <p>
        Valor a transferir externamente: <strong>{moneyMinor(preview.amountMinor)}</strong>
      </p>
      <p className="admin-note">
        Este registro não transfere dinheiro. Confirme somente após realizar o pagamento externo. Lotes de até 100
        comissões; compensações de estornos são descontadas automaticamente.
      </p>
      <fieldset disabled={busy || !preview.orderIds.length}>
        <label>
          Comprovante / observação
          <input name="note" required minLength={5} maxLength={1000} />
        </label>
        <label>
          <input type="checkbox" name="confirm" required /> Confirmo o pagamento externo ou a compensação integral.
        </label>
        <button className="button">{busy ? 'Registrando…' : 'Registrar como pago'}</button>
      </fieldset>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
