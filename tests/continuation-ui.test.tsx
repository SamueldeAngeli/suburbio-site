import React from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';
import { it, expect } from 'vitest';
import { productInput } from '@/lib/api/catalog-contracts';
import {
  GiftChoice,
  RecipientConfirmation,
  RenewalOptions,
  RenewalPreparation,
  SlotsSummary,
  VipQueue,
  RefundState,
} from '@/components/commerce-preparation';
import { ScreenPreview } from '@/components/screen/screen-preview';
import { benefitGroup } from '@/lib/commerce-preparation';
const product = {
  name: 'BMW',
  slug: 'bmw',
  description: '',
  categoryId: 'c7f96a10-8207-4235-a43e-5e73cbd066a1',
  imageUrl: '',
  status: 'active',
  displayOrder: 0,
  priceCrypto: 2000,
  priceMinor: 12000,
  stockMode: 'UNLIMITED',
  stockQuantity: 0,
  validityMode: 'DURATION',
  durationDays: 30,
  renewable: true,
  delivery: { deliveryType: 'VEHICLE', deliveryPayload: { vehicleModel: 'bmw' } },
};
it.each([['WEB'], ['INGAME'], ['WEB', 'INGAME'], ['SITE_VIP', 'INGAME_CRYPTO']])(
  'canal %j conserva um produto e preços independentes',
  (...channels) => {
    const result = productInput.parse({ ...product, salesChannels: channels });
    expect(result.slug).toBe('bmw');
    expect(result.priceMinor).toBe(12000);
    expect(result.priceCrypto).toBe(2000);
  },
);
it('aliases duplicados do mesmo canal são rejeitados', () =>
  expect(productInput.safeParse({ ...product, salesChannels: ['WEB', 'SITE_VIP'] }).success).toBe(false));
it.each(['VIP_STORE', 'VIP_DEALERSHIP', 'VIP_REAL_ESTATE', 'CRYPTO_STORE'])('storefront %s preservada', (storefront) =>
  expect(productInput.parse({ ...product, salesChannels: ['INGAME'], storefronts: [storefront] }).storefronts).toEqual([
    storefront,
  ]),
);
it('storefront duplicada ou desconhecida recusada', () => {
  for (const storefronts of [['VIP_STORE', 'VIP_STORE'], ['PUBLIC']])
    expect(productInput.safeParse({ ...product, salesChannels: ['INGAME'], storefronts }).success).toBe(false);
});
it.each(['VIP', 'VEHICLE', 'PROPERTY', 'INVENTORY_ITEM', 'CHARACTER_SLOT', 'SERVICE', 'CUSTOM'])(
  'agrupamento %s é somente apresentação',
  (type) => expect(['vip', 'veiculos', 'imoveis', 'outros']).toContain(benefitGroup(type)),
);
it('contrato não permite salvar tipos ainda ausentes', () => {
  for (const deliveryType of ['CRYPTO', 'CHARACTER_SLOT'])
    expect(
      productInput.safeParse({ ...product, salesChannels: ['WEB'], delivery: { deliveryType, deliveryPayload: {} } })
        .success,
    ).toBe(false);
});
it.each(['VEHICLE', 'PROPERTY'])('renovação %s mostra opções fornecidas sem calcular preço', () => {
  const html = render(
    <RenewalOptions
      entitlementId="e1"
      data={{
        entitlementId: 'e1',
        assetInstanceId: 'asset1',
        options: [
          { id: 'a', days: 7, amountMinor: 1234, currency: 'BRL' },
          { id: 'b', days: 15, amountMinor: 2345, currency: 'BRL' },
          { id: 'c', days: 30, amountMinor: 3456, currency: 'BRL' },
        ],
      }}
    />,
  );
  expect(html).toContain('7 dias');
  expect(html).toContain('15 dias');
  expect(html).toContain('30 dias');
  expect(html).toContain('12,34');
  expect(html).toContain('disabled');
});
it('renovação não mistura entitlement', () =>
  expect(
    render(
      <RenewalOptions
        entitlementId="other"
        data={{
          entitlementId: 'e1',
          assetInstanceId: 'a',
          options: [{ id: 'p', days: 7, amountMinor: 1234, currency: 'BRL' }],
        }}
      />,
    ),
  ).not.toContain('7 dias'));
it('renovar abre preparação sem fingir elegibilidade', () =>
  expect(render(<RenewalPreparation entitlementId="e1" />)).toContain('aria-expanded="false"'));
it('para si não solicita identidade livre', () =>
  expect(render(<GiftChoice value="self" onChange={() => {}} />)).not.toContain('Buscar destinatário'));
it('escolha de presente não confirma destinatário implicitamente', () => {
  const html = render(<GiftChoice value="gift" onChange={() => {}} />);
  expect(html).toContain('Presentear outra pessoa');
  expect(html).not.toContain('Destinatário confirmado');
});
it('recipient inválido não é confirmado', () =>
  expect(render(<RecipientConfirmation recipient={null} />)).toContain('disabled'));
it('VIP atual e fila somente refletem valores recebidos', () => {
  const html = render(
    <VipQueue
      data={{
        current: { name: 'Start', remaining: '45 dias' },
        next: [{ id: 'elite', name: 'Elite', duration: '30 dias' }],
      }}
    />,
  );
  expect(html).toContain('Start');
  expect(html).toContain('45 dias');
  expect(html).toContain('Elite');
  expect(html).toContain('Próximos');
});
it('ausência da fila não transforma PENDING em próximo VIP', () =>
  expect(render(<VipQueue />)).toContain('ainda não está disponível'));
it('slots 4/5 usam estado efetivo', () => {
  const html = render(
    <SlotsSummary data={{ effectiveCharacterSlots: 4, maximum: 5, purchaseAllowed: true, availableQuantity: 1 }} />,
  );
  expect(html).toContain('4 / 5');
  expect(html).toContain('aquisição: 1');
  expect(html).toContain('disabled');
});
it.each([false, true])('slots 5/5 bloqueados, destinatário %s', (recipient) => {
  const html = render(
    <SlotsSummary
      recipient={recipient}
      data={{ effectiveCharacterSlots: 5, maximum: 5, purchaseAllowed: false, availableQuantity: 0 }}
    />,
  );
  expect(html).toContain('limite máximo de 5');
  expect(html).not.toContain('<button');
});
it.each(['initiated', 'processing', 'refunded', 'review'] as const)(
  'estorno %s apresentado sem iniciar operação',
  (status) => {
    const html = render(<RefundState data={{ status, reason: 'slot_limit' }} />);
    expect(html).toContain('atingiu o limite máximo');
    expect(html).not.toContain('<button');
  },
);
it('salas sem contrato não geram host, código ou participantes falsos', () => {
  const html = render(<ScreenPreview />);
  expect(html).toContain('Criar sala');
  expect(html).toContain('Desconectado');
  expect(html).toContain('Participantes (0)');
  expect(html).not.toContain('Controles do host');
});
