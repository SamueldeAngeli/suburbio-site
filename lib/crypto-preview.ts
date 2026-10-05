import type { Product } from './site';
// Presentation only: API independently validates identifiers, prices and limits.
export const cryptoQuantities = [50, 100, 150, 200, 300, 400, 500, 700, 1000] as const;
export function cryptoPreview(mode: 'package' | 'custom', quantity: number): Product | null {
  if (
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > 1000000 ||
    (mode === 'package' && !cryptoQuantities.some((n) => n === quantity))
  )
    return null;
  return {
    id: `crypto-${mode}-${quantity}`,
    name: `${quantity.toLocaleString('pt-BR')} Crypto`,
    category: 'Crypto',
    price: (quantity * (mode === 'package' ? 120 : 125)) / 100,
    tag: mode === 'package' ? 'PACOTE CRYPTO' : 'QUANTIDADE PERSONALIZADA',
    description: 'Moeda virtual da cidade. A entrega depende da confirmação de pagamento e da cidade.',
    features: [`${quantity} Crypto`, 'Quantidade preservada independentemente de descontos'],
    level: 0,
    validityMode: 'PERMANENT',
    durationDays: null,
    renewable: false,
  };
}
export function cryptoPreviewFromId(id: string) {
  const match = /^crypto-(package|custom)-([1-9]\d{0,6})$/.exec(id);
  return match ? cryptoPreview(match[1] as 'package' | 'custom', Number(match[2])) : null;
}
