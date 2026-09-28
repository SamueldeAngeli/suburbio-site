'use client';
import {useState} from 'react';
import {ContributionNotice} from '@/components/contribution-notice';
import {Coins,Plus,ArrowRight,ShieldCheck} from 'lucide-react';
import {cryptoQuantities,cryptoPreview} from '@/lib/crypto-preview';
import type {z} from 'zod';
import {cryptoConfigSchema} from '@/lib/api/cart-contracts';
import type {Product} from '@/lib/site';
const money=(value:number)=>value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export function CryptoSection({onAdd,config}:{onAdd:(product:Product)=>void;config?:z.infer<typeof cryptoConfigSchema>}){
  const minimum=config?.minimum??1,maximum=config?.maximum??100000;
  const [quantity,setQuantity]=useState('325');
  const valid=/^[1-9]\d*$/.test(quantity)&&Number(quantity)>=minimum&&Number(quantity)<=maximum?cryptoPreview('custom',Number(quantity)):null;
  return <section className="crypto section" id="crypto"><div className="section-heading"><div><div className="eyebrow">MOEDA VIRTUAL DO SUBÚRBIO</div><h2>Seu próximo passo.<br/><span>Em Crypto.</span></h2></div><p>Escolha um pacote ou sua quantidade.<br/>Um universo de possibilidades na cidade.</p></div><div className="crypto-packages">{cryptoQuantities.map(n=>{const product=cryptoPreview('package',n)!;return <article className="crypto-package" key={n}><Coins size={23}/><div><h3>{n.toLocaleString('pt-BR')} <span>Crypto</span></h3><p>R$ 1,20 por Crypto</p></div><strong>{money(product.price)}</strong><button className="add-button" aria-label={`Adicionar pacote de ${n} Crypto`} onClick={()=>onAdd(product)}><Plus size={19}/></button></article>;})}</div><div className="crypto-custom"><div><span className="eyebrow">DO SEU JEITO</span><h3>Escolha sua quantidade.</h3><p>R$ 1,25 por Crypto · de {minimum.toLocaleString('pt-BR')} a {maximum.toLocaleString('pt-BR')} unidades.</p></div><form onSubmit={e=>{e.preventDefault();if(valid)onAdd(valid);}}><label htmlFor="crypto-quantity">Quantidade de Crypto</label><div className="crypto-quantity"><input id="crypto-quantity" type="number" inputMode="numeric" min={minimum} max={maximum} step={1} required value={quantity} onChange={e=>setQuantity(e.target.value)} aria-describedby="crypto-total"/><button className="button" disabled={!valid}>Adicionar <ArrowRight size={17}/></button></div><p id="crypto-total" aria-live="polite">{valid?`Total estimado: ${money(valid.price)}`:`Informe um número inteiro entre ${minimum.toLocaleString('pt-BR')} e ${maximum.toLocaleString('pt-BR')}.`}</p></form></div><p className="store-notice"><ShieldCheck size={16}/> Prévia no carrinho. Compras ainda indisponíveis; nenhuma cobrança ou entrega é realizada.</p><ContributionNotice/></section>;
}
