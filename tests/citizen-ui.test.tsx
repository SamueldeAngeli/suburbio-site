// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const actions = vi.hoisted(() => ({ loginDiscord: vi.fn(), logout: vi.fn() }));
vi.mock('@/lib/auth/actions', () => actions);
import { UserMenu, UserNav } from '@/components/site/user-nav';
import { Avatar } from '@/components/site/avatar';
import { AccountShell } from '@/components/account/account-shell';
vi.mock('next/navigation', () => ({ usePathname: () => '/minha-conta' }));
const image = 'https://cdn.discordapp.com/avatars/403707367885242378/1234567890abcdef1234567890abcdef.png?size=128';
const user = { name: 'TecCode', username: 'teccode', image };
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => vi.clearAllMocks());
it('deslogado oferece o mesmo login Discord real', async () => {
  render(<UserMenu state={{ status: 'unauthenticated' }} />);
  await userEvent.click(screen.getByRole('button', { name: 'Entrar com Discord' }));
  await waitFor(() => expect(actions.loginDiscord).toHaveBeenCalledOnce());
});
it('logado exibe nome e avatar real sem botão de login nem Discord ID', () => {
  render(<UserMenu state={{ status: 'authenticated', user }} />);
  expect(screen.queryByText('Entrar com Discord')).toBeNull();
  expect(screen.getByText('TecCode')).toBeTruthy();
  expect(screen.getByRole('img', { name: 'Avatar de TecCode' }).getAttribute('src')).toBe(image);
  expect(document.body.textContent).not.toContain('403707367885242378');
});
it('click abre menu com apenas perfil e sair', async () => {
  render(<UserMenu state={{ status: 'authenticated', user }} />);
  const trigger = screen.getByRole('button', { name: 'Conta de TecCode' });
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  await userEvent.click(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getAllByRole('menuitem')).toHaveLength(2);
  expect(screen.getByRole('menuitem', { name: 'Ver perfil' }).getAttribute('href')).toBe('/minha-conta');
});
it('click fora fecha o dropdown', async () => {
  render(
    <>
      <UserMenu state={{ status: 'authenticated', user }} />
      <button>Fora</button>
    </>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Conta de TecCode' }));
  await userEvent.click(screen.getByRole('button', { name: 'Fora' }));
  expect(screen.queryByRole('menu')).toBeNull();
});
it('ESC fecha e restaura foco no gatilho', async () => {
  render(<UserMenu state={{ status: 'authenticated', user }} />);
  const trigger = screen.getByRole('button', { name: 'Conta de TecCode' });
  await userEvent.click(trigger);
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('menu')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
it('setas, Home e End navegam com foco correto', async () => {
  render(<UserMenu state={{ status: 'authenticated', user }} />);
  screen.getByRole('button', { name: 'Conta de TecCode' }).focus();
  await userEvent.keyboard('{ArrowDown}');
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Ver perfil' }));
  await userEvent.keyboard('{ArrowDown}');
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Sair' }));
  await userEvent.keyboard('{Home}');
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Ver perfil' }));
  await userEvent.keyboard('{End}');
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Sair' }));
});
it('Tab permite sair do menu sem prender o foco', async () => {
  render(
    <>
      <UserMenu state={{ status: 'authenticated', user }} />
      <button>Próximo</button>
    </>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Conta de TecCode' }));
  await userEvent.keyboard('{End}{Tab}');
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Próximo' }));
  expect(screen.queryByRole('menu')).toBeNull();
});
it('Sair executa logout real existente', async () => {
  render(<UserMenu state={{ status: 'authenticated', user }} />);
  await userEvent.click(screen.getByRole('button', { name: 'Conta de TecCode' }));
  await userEvent.click(screen.getByRole('menuitem', { name: 'Sair' }));
  await waitFor(() => expect(actions.logout).toHaveBeenCalledOnce());
});
it('nome longo mantém nome completo acessível e no dropdown', async () => {
  const name = 'SamuelDeAngeliRodrigues'.repeat(4);
  render(<UserMenu state={{ status: 'authenticated', user: { ...user, name } }} />);
  const trigger = screen.getByRole('button', { name: `Conta de ${name}` });
  expect(trigger.title).toBe(name);
  await userEvent.click(trigger);
  expect(screen.getAllByText(name)).toHaveLength(2);
});
it('avatar inexistente usa fallback com inicial e nome acessível', () => {
  render(<Avatar name="Samuel" />);
  expect(screen.getByRole('img', { name: 'Avatar de Samuel' }).textContent).toBe('S');
});
it('erro de carregamento da imagem usa fallback', () => {
  render(<Avatar name="Samuel" image={image} />);
  fireEvent.error(screen.getByRole('img', { name: 'Avatar de Samuel' }));
  expect(screen.getByRole('img', { name: 'Avatar de Samuel' }).textContent).toBe('S');
});
it('loading não mostra login nem usuário incorreto', () => {
  render(<UserMenu state={{ status: 'loading' }} />);
  expect(screen.getByRole('status').getAttribute('aria-label')).toBe('Carregando sua conta');
  expect(screen.queryByRole('button')).toBeNull();
});
it('sessão carregada substitui skeleton diretamente por perfil', async () => {
  let resolve!: (r: Response) => void;
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    ),
  );
  render(<UserNav />);
  expect(screen.queryByText('Entrar com Discord')).toBeNull();
  resolve(Response.json({ user: { ...user, discordId: '403707367885242378' } }));
  await screen.findByRole('button', { name: 'Conta de TecCode' });
  expect(screen.queryByText('Entrar com Discord')).toBeNull();
});
it('sessão vazia carrega botão deslogado', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({})),
  );
  render(<UserNav />);
  expect(await screen.findByRole('button', { name: 'Entrar com Discord' })).toBeTruthy();
});
it('falha de rede não afirma que usuário está deslogado', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw Error();
    }),
  );
  render(<UserNav />);
  expect(await screen.findByRole('link', { name: 'Acessar minha conta' })).toBeTruthy();
  expect(screen.queryByText('Entrar com Discord')).toBeNull();
});
it('perfil integra navegação e não divulga ID', () => {
  render(
    <AccountShell user={user}>
      <p>Conteúdo</p>
    </AccountShell>,
  );
  expect(screen.getByRole('navigation', { name: 'Área do cidadão' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Visão geral' }).getAttribute('aria-current')).toBe('page');
  expect(document.body.textContent).not.toContain('403707367885242378');
  expect(screen.queryByText('Salve,')).toBeNull();
});
