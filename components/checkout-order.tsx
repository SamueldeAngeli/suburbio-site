'use client';
import { useRef, useState } from 'react';
export function CheckoutOrder({ id }: { id: string }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    key = useRef('');
  async function pay() {
    if (busy) return;
    key.current ||= crypto.randomUUID();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/vip/orders/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-suburbio-intent': 'order.checkout' },
        body: JSON.stringify({ id, idempotencyKey: key.current }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error?.message ?? 'Não foi possível preparar o pagamento.');
        return;
      }
      const url = new URL(result.data.checkoutUrl);
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        !['www.mercadopago.com.br', 'sandbox.mercadopago.com.br'].includes(url.hostname)
      )
        throw Error();
      window.location.assign(url.toString());
    } catch {
      setMessage('Não foi possível conectar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button className="button" onClick={pay} disabled={busy}>
        {busy ? 'Preparando pagamento…' : 'Pagar com Mercado Pago'}
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
