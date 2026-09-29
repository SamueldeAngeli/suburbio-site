export function commerceAmount(value:string,currency:string){
 if(currency==='CRYPTO')return BigInt(value).toLocaleString('pt-BR')+' Crypto';
 return (Number(value)/100).toLocaleString('pt-BR',{style:'currency',currency});
}
