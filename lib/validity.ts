export type ProductValidity = {
  validityMode: 'PERMANENT' | 'DURATION';
  durationDays: number | null;
  renewable: boolean;
};
export function validityLabel(value: Pick<ProductValidity, 'validityMode' | 'durationDays'>) {
  return value.validityMode === 'DURATION'
    ? `${value.durationDays} ${value.durationDays === 1 ? 'dia' : 'dias'}`
    : 'Permanente';
}
