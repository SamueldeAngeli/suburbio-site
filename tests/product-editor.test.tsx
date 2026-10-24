// @vitest-environment jsdom
import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
import { ProductEditor } from '@/components/admin/product-editor';

const categories = [
  {
    id: 'c51ce4b9-8260-4bca-9abb-f7faf8d090e9',
    name: 'ITENS',
    slug: 'item',
    displayOrder: 0,
    status: 'active' as const,
    revision: 1,
    createdAt: '2026-10-20T21:14:47.205Z',
    updatedAt: '2026-10-20T21:14:47.205Z',
  },
];
afterEach(cleanup);

it('mostra só os campos do tipo escolhido, sem códigos técnicos', () => {
  render(<ProductEditor categories={categories} canDisable />);
  expect(screen.getByText('Nome do item no jogo')).toBeTruthy();
  expect(screen.queryByText(/INVENTORY_ITEM|SITE_VIP|INGAME_CRYPTO/)).toBeNull();
  // Item é sempre permanente: sem etapa de validade.
  expect(screen.queryByText('4. Validade')).toBeNull();
  fireEvent.click(screen.getByText('VIP'));
  expect(screen.getByRole('combobox', { name: 'Plano' })).toBeTruthy();
  expect(screen.getByText('4. Validade')).toBeTruthy();
  expect(screen.queryByText('Nome do item no jogo')).toBeNull();
});

it('identificador nasce do nome e o preço do jogo só aparece ao vender no jogo', () => {
  render(<ProductEditor categories={categories} canDisable />);
  fireEvent.change(screen.getByPlaceholderText('Kit de Reparo'), { target: { value: 'Caixa de Som Ação' } });
  fireEvent.click(screen.getByText('Mais opções'));
  expect((screen.getByLabelText('Identificador (endereço)') as HTMLInputElement).value).toBe('caixa-de-som-acao');
  expect(screen.queryByText('Preço (Crypto)')).toBeNull();
  fireEvent.click(screen.getByLabelText('Vender no jogo'));
  expect(screen.getByText('Preço (Crypto)')).toBeTruthy();
});

it('erro em linguagem simples antes de enviar', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  render(<ProductEditor categories={categories} canDisable />);
  fireEvent.click(screen.getByLabelText('Vender no site'));
  fireEvent.click(screen.getByRole('button', { name: 'Cadastrar produto' }));
  expect(screen.getByRole('status').textContent).toBe(
    'Marque onde o produto será vendido: no site, no jogo ou nos dois.',
  );
  expect(fetchSpy).not.toHaveBeenCalled();
});
