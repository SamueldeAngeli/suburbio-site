'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {z} from 'zod';
import {cartQuoteSchema} from '@/lib/api/cart-contracts';
type Quote=z.infer<typeof cartQuoteSchema>;
export function CartQuote({cart,couponCode}:{cart:Record<string,number>;couponCode:string}){
  const [state,setState]=useState<{quote?:Quote;error?:string;login?:boolean}>({});
  useEffect(()=>{const abort=new AbortController();const items=Object.entries(cart).map(([id,quantity])=>{const match=/^crypto-(package|custom)-(\d+)$/.exec(id);return match?{kind:'crypto',mode:match[1],quantity:Number(match[2]),units:quantity}:{kind:'product',productId:id,quantity};});
    void fetch('/api/vip/quote',{method:'POST',headers:{'Content-Type':'application/json','x-suburbio-intent':'cart.quote'},body:JSON.stringify({items,couponCode:couponCode||undefined}),signal:abort.signal}).then(async r=>{const body=await r.json();if(abort.signal.aborted)return;if(!r.ok){setState({error:r.status===401?'Entre com Discord para conferir seu pedido.':(body.error?.message??'Não foi possível conferir o carrinho.'),login:r.status===401});return;}const parsed=cartQuoteSchema.safeParse(body.data);setState(parsed.success?{quote:parsed.data}:{error:'Resposta indisponível. Tente novamente.'});}).catch(()=>{if(!abort.signal.aborted)setState({error:'Não foi possível conectar. Tente novamente.'});});return()=>abort.abort();
  },[cart,couponCode]);
  if(state.error)return <div className="pending" role="alert"><div><p>{state.error}</p>{state.login&&<Link href="/login" className="button small">Entrar com Discord</Link>}</div></div>;
  if(!state.quote)return <p role="status">Conferindo valores e disponibilidade…</p>;
  return <div className="pending" role="status"><div><strong>Valores conferidos</strong>{state.quote.coupon&&<p>Cupom {state.quote.coupon.couponCodeSnapshot}: desconto de {(state.quote.discountAmountMinor/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p>}<p>Total: {(state.quote.netAmountMinor/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p><p>O pagamento pelo Mercado Pago ainda não está disponível. Conferir o carrinho não reserva estoque nem realiza cobrança.</p></div></div>;
}
