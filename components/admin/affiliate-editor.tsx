'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { z } from 'zod';
import { affiliateSchema, affiliateInput } from '@/lib/api/affiliate-contracts';
export function AffiliateEditor({ affiliate: a }: { affiliate?: z.infer<typeof affiliateSchema> }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    last = useRef(''),
    key = useRef('');
  const router = useRouter();
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget),
      text = (n: string) => String(f.get(n) ?? '');
    const input = {
      discordId: text('discordId'),
      name: text('name'),
      couponName: text('couponName'),
      code: text('code'),
      discountPercent: Number(f.get('discountPercent')),
      commissionPercent: Number(f.get('commissionPercent')),
      holdDays: Number(f.get('holdDays')),
      status: text('status'),
      type: text('type'),
      expiresAt: text('expiresAt') ? new Date(text('expiresAt') + 'Z').toISOString() : null,
      notes: text('notes'),
    };
    const parsed = affiliateInput.safeParse(input);
    if (!parsed.success) {
      setMessage('Confira os campos informados.');
      return;
    }
    const data = {
        affiliate: parsed.data,
        reason: text('reason'),
        confirm: f.has('confirm'),
        ...(a ? { expectedRevision: a.revision } : {}),
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
          body: JSON.stringify({ action: 'save', id: a?.id, data, idempotencyKey: key.current }),
        }),
        body = await r.json();
      if (!r.ok) {
        setMessage(body.error?.message ?? 'Não foi possível salvar.');
        return;
      }
      router.push('/admin/affiliates/' + body.affiliate.id);
      router.refresh();
    } catch {
      setMessage('Conexão interrompida. Tente novamente com os mesmos dados.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="admin-editor" onSubmit={save}>
      <fieldset disabled={busy}>
        <legend>{a ? 'Editar afiliado' : 'Cadastrar afiliado'}</legend>
        <div className="admin-form-grid">
          <label>
            Nome do afiliado
            <input name="name" required minLength={2} maxLength={100} defaultValue={a?.name} />
          </label>
          <label>
            Discord ID
            <input name="discordId" required pattern="[0-9]{17,20}" readOnly={!!a} defaultValue={a?.discordId} />
          </label>
          <label>
            Nome do cupom
            <input name="couponName" required minLength={2} maxLength={100} defaultValue={a?.couponName} />
          </label>
          <label>
            Código do cupom
            <input name="code" required minLength={3} maxLength={32} pattern="[A-Za-z0-9_-]+" defaultValue={a?.code} />
          </label>
          <label>
            Desconto do cliente (%)
            <input
              name="discountPercent"
              type="number"
              min={0}
              max={99}
              step={1}
              required
              defaultValue={a?.discountPercent ?? 5}
            />
          </label>
          <label>
            Comissão do afiliado (%)
            <input
              name="commissionPercent"
              type="number"
              min={0}
              max={100}
              step={1}
              required
              defaultValue={a?.commissionPercent ?? 8}
            />
          </label>
          <label>
            Janela de segurança (dias)
            <input name="holdDays" type="number" min={0} max={365} step={1} required defaultValue={a?.holdDays ?? 14} />
          </label>
          <label>
            Validade opcional (UTC)
            <input name="expiresAt" type="datetime-local" defaultValue={a?.expiresAt?.slice(0, 16)} />
          </label>
          <label>
            Tipo
            <select name="type" defaultValue={a?.type ?? 'PARTNER'}>
              {[
                ['STAFF', 'Staff'],
                ['STREAMER', 'Streamer'],
                ['CREATOR', 'Criador'],
                ['PARTNER', 'Parceiro'],
                ['OTHER', 'Outro'],
              ].map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue={a?.status ?? 'ACTIVE'}>
              {[
                ['ACTIVE', 'Ativo'],
                ['DISABLED', 'Desativado'],
                ['SUSPENDED', 'Suspenso'],
                ['CLOSED', 'Encerrado'],
              ].map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Observações internas
          <textarea name="notes" maxLength={2000} defaultValue={a?.notes} />
        </label>
        <label>
          Motivo da alteração
          <textarea name="reason" minLength={5} maxLength={500} required />
        </label>
        <label>
          <input name="confirm" type="checkbox" required /> Confirmo o cadastro e os percentuais acima.
        </label>
        <p className="admin-note">
          Desconto e comissão são independentes. A comissão incide sobre o valor pago após desconto. Alterações não
          modificam vendas anteriores.
        </p>
        <button className="button">{busy ? 'Salvando…' : 'Salvar afiliado'}</button>
      </fieldset>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
