'use client';
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
export function CancelOrder({id}:{id:string}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),key=useRef(''),router=useRouter();
 async function cancel(){if(busy)return;key.current ||= crypto.randomUUID();setBusy(true);setMessage('');try{const reply=await fetch('/api/vip/orders/cancel',{method:'POST',headers:{'content-type':'application/json','x-suburbio-intent':'order.cancel'},body:JSON.stringify({id,idempotencyKey:key.current})});const result=await reply.json();if(!reply.ok){setMessage(result.error?.message??'Não foi possível cancelar o pedido.');return;}router.refresh();}catch{setMessage('Conexão interrompida. Tente novamente.');}finally{setBusy(false);}}
 return <div><p>Ao cancelar, os itens reservados voltam a ficar disponíveis e o cupom é liberado.</p><button className="button outline" disabled={busy} onClick={cancel}>{busy?'Cancelando…':'Cancelar pedido pendente'}</button>{message&&<p role="status">{message}</p>}</div>;
}
