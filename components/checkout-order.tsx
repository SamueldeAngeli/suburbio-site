'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
// free: total R$ 0,00 (cupom de 100%) — a API confirma o pedido sem Mercado Pago.
export function CheckoutOrder({ id, free = false }: { id: string; free?: boolean }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    key = useRef(''),
    router = useRouter();
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
      if (result.data.confirmed === true) {
        setMessage('Pedido confirmado. A entrega segue as etapas abaixo.');
        router.refresh();
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
        {free
          ? busy
            ? 'Confirmando…'
            : 'Confirmar pedido gratuito'
          : busy
            ? 'Preparando pagamento…'
            : 'Pagar com Mercado Pago'}
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
