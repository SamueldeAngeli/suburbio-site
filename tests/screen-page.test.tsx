// @vitest-environment jsdom
import React from 'react';
import { it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
const m = vi.hoisted(() => ({ session: vi.fn(), env: vi.fn(), redirect: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ currentSession: m.session }));
vi.mock('@/lib/server/env', () => ({ serverEnv: m.env }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    m.redirect(url);
    throw new Error('NEXT_REDIRECT');
  },
}));
vi.mock('@/components/screen/screen-preview', () => ({
  ScreenPreview: ({ maxCapacity }: { maxCapacity: number }) => <div>UI de transmissão · {maxCapacity}</div>,
}));
import ScreenPage from '@/app/tela/page';

beforeEach(() => m.session.mockResolvedValue({ user: { discordId: '123456789012345678' } }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('transmissão desligada mostra indisponível sem montar a UI de mídia', async () => {
  m.env.mockReturnValue({ LIVEKIT_ENABLED: false });
  render(await ScreenPage());
  expect(screen.getByText('Transmissão indisponível')).toBeTruthy();
  expect(screen.queryByText(/UI de transmissão/)).toBeNull();
});

it('configuração inválida também vira indisponível, sem stack trace', async () => {
  m.env.mockImplementation(() => {
    throw new Error('Configuração ausente ou inválida: LIVEKIT_API_SECRET');
  });
  render(await ScreenPage());
  expect(screen.getByText('Transmissão indisponível')).toBeTruthy();
  expect(document.body.textContent).not.toContain('LIVEKIT_API_SECRET');
});

it('ligada, entrega à UI só a capacidade máxima (nenhum segredo)', async () => {
  m.env.mockReturnValue({ LIVEKIT_ENABLED: true, LIVEKIT_ROOM_MAX_PARTICIPANTS: 6, LIVEKIT_API_SECRET: 'segredo' });
  render(await ScreenPage());
  expect(screen.getByText('UI de transmissão · 6')).toBeTruthy();
  expect(document.body.textContent).not.toContain('segredo');
});

it('sem sessão redireciona ao login', async () => {
  m.session.mockResolvedValue(null);
  await expect(ScreenPage()).rejects.toThrow('NEXT_REDIRECT');
  expect(m.redirect).toHaveBeenCalledWith('/login?returnTo=/tela');
});
