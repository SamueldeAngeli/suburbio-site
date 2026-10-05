export function moneyMinor(value: string) {
  const v = BigInt(value);
  return 'R$ ' + (v / BigInt(100)).toLocaleString('pt-BR') + ',' + (v % BigInt(100)).toString().padStart(2, '0');
}
