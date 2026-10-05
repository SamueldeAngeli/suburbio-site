import { describe, it, expect } from 'vitest';
import { commerceAmount } from '../lib/commerce-amount';
import { entitlementSchema } from '../lib/api/entitlement-contracts';
describe('Crypto no histórico comercial', () => {
  it('mantém inteiros Crypto sem dividir por 100', () => expect(commerceAmount('1200', 'CRYPTO')).toBe('1.200 Crypto'));
  it('preserva precisão acima do limite seguro Number', () =>
    expect(commerceAmount('9007199254740993', 'CRYPTO')).toBe('9.007.199.254.740.993 Crypto'));
  it('mantém BRL em centavos', () => expect(commerceAmount('1200', 'BRL')).toMatch(/12,00/));
  it('aceita ambas as origens dos benefícios', () => {
    expect(entitlementSchema.shape.origin.parse('INGAME')).toBe('INGAME');
    expect(entitlementSchema.shape.origin.parse('SITE_VIP')).toBe('SITE_VIP');
  });
});
