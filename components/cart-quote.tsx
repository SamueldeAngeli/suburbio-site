'use client';
import { GiftRecipient, type GiftSelection } from '@/components/gift-recipient';
import { GiftChoice } from '@/components/commerce-preparation';
import '@/app/minha-conta/benefits.css';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { cartQuoteSchema } from '@/lib/api/cart-contracts';
type Quote = z.infer<typeof cartQuoteSchema>;
export function CartQuote({ cart, couponCode }: { cart: Record<string, number>; couponCode: string }) {
  const [gift, setGift] = useState<GiftSelection | null>(null);
  const [recipientMode, setRecipientMode] = useState<'self' | 'gift'>('self');
  const router = useRouter(),
    key = useRef({ fingerprint: '', id: '' }),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const [state, setState] = useState<{ quote?: Quote; error?: string; login?: boolean }>({});
  useEffect(() => {
    const abort = new AbortController();
    const items = Object.entries(cart).map(([id, quantity]) => {
      const match = /^crypto-(package|custom)-(\d+)$/.exec(id);
      return match
        ? { kind: 'crypto', mode: match[1], quantity: Number(match[2]), units: quantity }
        : { kind: 'product', productId: id, quantity };
    });
    void fetch('/api/vip/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-suburbio-intent': 'cart.quote' },
      body: JSON.stringify({ items, couponCode: couponCode || undefined }),
      signal: abort.signal,
    })
      .then(async (r) => {
        const body = await r.json();
        if (abort.signal.aborted) return;
        if (!r.ok) {
          setState({
            error:
              r.status === 401
                ? 'Entre com Discord para conferir seu pedido.'
                : (body.error?.message ?? 'Não foi possível conferir o carrinho.'),
            login: r.status === 401,
          });
          return;
        }
        const parsed = cartQuoteSchema.safeParse(body.data);
        setState(parsed.success ? { quote: parsed.data } : { error: 'Resposta indisponível. Tente novamente.' });
      })
      .catch(() => {
        if (!abort.signal.aborted) setState({ error: 'Não foi possível conectar. Tente novamente.' });
      });
    return () => abort.abort();
  }, [cart, couponCode]);
  async function purchase() {
    if (busy || (recipientMode === 'gift' && !gift)) return;
    const items = Object.entries(cart).map(([id, quantity]) => {
      const match = /^crypto-(package|custom)-(\d+)$/.exec(id);
      return match
        ? { kind: 'crypto', mode: match[1], quantity: Number(match[2]), units: quantity }
        : { kind: 'product', productId: id, quantity };
    });
    const input = { items, couponCode: couponCode || undefined, ...(recipientMode === 'gift' && gift ? { gift } : {}) },
      fingerprint = JSON.stringify(input);
    if (key.current.fingerprint !== fingerprint) key.current = { fingerprint, id: crypto.randomUUID() };
    setBusy(true);
    setMessage('');
    try {
      const r = await fetch('/api/vip/orders/create', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-suburbio-intent': 'order.create' },
          body: JSON.stringify({ ...input, idempotencyKey: key.current.id }),
        }),
        result = await r.json();
      if (!r.ok) {
        setMessage(result.error?.message ?? 'Não foi possível criar o pedido.');
        return;
      }
      if (!z.uuid().safeParse(result.data?.order?.id).success) throw Error();
      router.push('/minha-conta/pedidos/' + result.data.order.id);
    } catch {
      setMessage('Conexão interrompida. Tente novamente com o mesmo carrinho.');
    } finally {
      setBusy(false);
    }
  }
  if (state.error)
    return (
      <div className="pending" role="alert">
        <div>
          <p>{state.error}</p>
          {state.login && (
            <Link href="/login" className="button small">
              Entrar com Discord
            </Link>
          )}
        </div>
      </div>
    );
  if (!state.quote) return <p role="status">Conferindo valores e disponibilidade…</p>;
  return (
    <div className="pending" role="status">
      <div>
        <strong>Valores conferidos</strong>
        <GiftChoice
          value={recipientMode}
          onChange={(value) => {
            setRecipientMode(value);
            setGift(null);
          }}
        />
        {recipientMode === 'gift' && <GiftRecipient onChange={setGift} />}
        {state.quote.coupon && (
          <p>
            Cupom {state.quote.coupon.couponCodeSnapshot}: desconto de{' '}
            {(state.quote.discountAmountMinor / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        )}
        <p>
          Total: {(state.quote.netAmountMinor / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>
        {state.quote.checkoutAvailable ? (
          <>
            <p>
              Ao continuar, a cidade verificará a disponibilidade dos itens. O pagamento será feito no Mercado Pago.
            </p>
            <button className="button" disabled={busy || (recipientMode === 'gift' && !gift)} onClick={purchase}>
              {busy ? 'Criando pedido…' : 'Continuar para pagamento'}
            </button>
          </>
        ) : (
          <p>Pagamento temporariamente indisponível. Conferir o carrinho não reserva estoque.</p>
        )}
        {message && <p role="alert">{message}</p>}
      </div>
    </div>
  );
}
