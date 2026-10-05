// @vitest-environment jsdom
import React from 'react';
import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { GiftRecipient } from '@/components/gift-recipient';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('lookup requires explicit confirmation and anonymous changes invalidate it', async () => {
  const change = vi.fn();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      Response.json({
        data: {
          recipientToken: 'signed-recipient-token',
          displayName: 'João Silva',
          discordId: '223456789012345678',
          expiresAt: '2099-01-01T00:00:00Z',
        },
      }),
    ),
  );
  render(<GiftRecipient onChange={change} />);
  fireEvent.change(screen.getByPlaceholderText('ID da conta Discord'), { target: { value: '223456789012345678' } });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar destinatário' }));
  await screen.findByText('João Silva');
  expect(change).not.toHaveBeenCalledWith(expect.objectContaining({ confirmed: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar destinatário' }));
  expect(change).toHaveBeenLastCalledWith({
    recipientToken: 'signed-recipient-token',
    confirmed: true,
    anonymousGift: false,
  });
  fireEvent.click(screen.getByLabelText('Presentear anonimamente'));
  expect(change).toHaveBeenLastCalledWith(null);
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar destinatário' }));
  expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ anonymousGift: true }));
});
