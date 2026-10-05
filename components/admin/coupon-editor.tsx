'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { z } from 'zod';
import { couponInput, couponSchema } from '@/lib/api/coupon-contracts';
type Choice = { id: string; name: string };
export function CouponEditor({
  coupon,
  products,
  categories,
}: {
  coupon?: z.infer<typeof couponSchema>;
  products: Choice[];
  categories: Choice[];
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const router = useRouter(),
    key = useRef(''),
    last = useRef('');
  const [type, setType] = useState(coupon?.discountType ?? 'percentage'),
    [scope, setScope] = useState(coupon?.scope ?? 'ALL');
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const number = (name: string) => Number(form.get(name));
    const optionalNumber = (name: string) => (form.get(name) ? number(name) : null);
    const date = (name: string) =>
      form.get(name)
        ? Number.isFinite(Date.parse(String(form.get(name)) + 'Z'))
          ? new Date(String(form.get(name)) + 'Z').toISOString()
          : 'invalid'
        : null;
    const data = {
      code: String(form.get('code')),
      discountType: type,
      discountValue: type === 'fixed' ? Math.round(number('discountValue') * 100) : number('discountValue'),
      minimumAmountMinor: Math.round(number('minimum') * 100),
      startsAt: date('startsAt'),
      expiresAt: date('expiresAt'),
      maxUses: optionalNumber('maxUses'),
      maxUsesPerUser: optionalNumber('maxUsesPerUser'),
      scope,
      productIds: form.getAll('productIds').map(String),
      categoryIds: form.getAll('categoryIds').map(String),
      firstPurchaseOnly: form.has('firstPurchaseOnly'),
      status: String(form.get('status')),
    };
    const parsed = couponInput.safeParse(data);
    if (!parsed.success) {
      setMessage('Confira valores, datas e os itens selecionados.');
      return;
    }
    const raw = JSON.stringify(data);
    if (raw !== last.current) {
      last.current = raw;
      key.current = crypto.randomUUID();
    }
    setBusy(true);
    try {
      const r = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-suburbio-intent': 'coupon.save' },
        body: JSON.stringify({
          coupon: parsed.data,
          id: coupon?.id,
          expectedRevision: coupon?.revision,
          idempotencyKey: key.current,
        }),
      });
      const result = await r.json();
      if (!r.ok) {
        setMessage(result.error?.message ?? 'Não foi possível salvar.');
        return;
      }
      router.push('/admin/coupons');
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
        <legend>Regras do cupom</legend>
        <div className="admin-form-grid">
          <label>
            Código
            <input
              name="code"
              required
              minLength={3}
              maxLength={32}
              pattern="[A-Za-z0-9_-]+"
              defaultValue={coupon?.code}
              placeholder="CUPOM15"
            />
          </label>
          <label>
            Status
            <select name="status" defaultValue={coupon?.status ?? 'active'}>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
              <option value="archived">Arquivado</option>
            </select>
          </label>
          <label>
            Tipo de desconto
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="percentage">Percentual</option>
              <option value="fixed">Valor fixo</option>
            </select>
          </label>
          <label>
            {type === 'percentage' ? 'Desconto (%)' : 'Desconto (R$)'}
            <input
              key={type}
              name="discountValue"
              type="number"
              min={type === 'percentage' ? 1 : 0.01}
              max={type === 'percentage' ? 100 : 1000000}
              step={type === 'percentage' ? 1 : 0.01}
              required
              defaultValue={
                coupon ? (coupon.discountType === 'fixed' ? coupon.discountValue / 100 : coupon.discountValue) : 15
              }
            />
          </label>
          <label>
            Compra mínima (R$)
            <input
              name="minimum"
              type="number"
              min={0}
              max={1000000}
              step="0.01"
              defaultValue={(coupon?.minimumAmountMinor ?? 0) / 100}
              required
            />
          </label>
          <label>
            Aplicar a
            <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
              <option value="ALL">Todo o carrinho</option>
              <option value="VIP">Benefícios VIP</option>
              <option value="CRYPTO">Crypto</option>
              <option value="PRODUCT">Produtos selecionados</option>
              <option value="CATEGORY">Categorias selecionadas</option>
            </select>
          </label>
          <label>
            Início (UTC)
            <input name="startsAt" type="datetime-local" defaultValue={coupon?.startsAt?.slice(0, 16)} />
          </label>
          <label>
            Fim (UTC)
            <input name="expiresAt" type="datetime-local" defaultValue={coupon?.expiresAt?.slice(0, 16)} />
          </label>
          <label>
            Limite total de usos
            <input
              name="maxUses"
              type="number"
              min={1}
              step={1}
              defaultValue={coupon?.maxUses ?? ''}
              placeholder="Sem limite"
            />
          </label>
          <label>
            Limite por pessoa
            <input
              name="maxUsesPerUser"
              type="number"
              min={1}
              step={1}
              defaultValue={coupon?.maxUsesPerUser ?? ''}
              placeholder="Sem limite"
            />
          </label>
        </div>
        {scope === 'PRODUCT' && (
          <label>
            Produtos
            <select multiple name="productIds" defaultValue={coupon?.productIds ?? []}>
              {[
                ...products,
                ...(coupon?.productIds ?? [])
                  .filter((id) => !products.some((p) => p.id === id))
                  .map((id) => ({ id, name: 'Benefício fora do catálogo atual (' + id.slice(0, 8) + ')' })),
              ].map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {scope === 'CATEGORY' && (
          <label>
            Categorias
            <select multiple name="categoryIds" defaultValue={coupon?.categoryIds ?? []}>
              {[
                ...categories,
                ...(coupon?.categoryIds ?? [])
                  .filter((id) => !categories.some((c) => c.id === id))
                  .map((id) => ({ id, name: 'Categoria fora do catálogo atual (' + id.slice(0, 8) + ')' })),
              ].map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="admin-channel-options">
          <label>
            <input name="firstPurchaseOnly" type="checkbox" defaultChecked={coupon?.firstPurchaseOnly} /> Somente
            primeira compra
          </label>
        </div>
        <p className="admin-note">
          Somente o proprietário pode alterar cupons. O desconto afeta o valor pago, nunca a quantidade de Crypto.
        </p>
        <button className="button">{busy ? 'Salvando…' : 'Salvar cupom'}</button>
      </fieldset>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
