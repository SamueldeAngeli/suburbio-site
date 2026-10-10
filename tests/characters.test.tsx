// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { charactersSchema, type Character } from '@/lib/api/citizen-contracts';
import { CharacterDetails, CharacterSlots } from '@/components/account/character-cards';

const m = vi.hoisted(() => ({ session: vi.fn(), characters: vi.fn(), redirect: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ currentSession: m.session }));
vi.mock('@/lib/api/client', () => ({
  SuburbioApiClient: class {
    citizenCharacters = m.characters;
  },
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    m.redirect(url);
    throw new Error('NEXT_REDIRECT');
  },
}));
import Characters from '@/app/minha-conta/personagens/page';
import { SiteError } from '@/lib/api/errors';

const character: Character = {
  citizenId: 'ABC00001',
  slot: 1,
  firstName: 'Ana',
  lastName: 'Souza',
  phone: '5551234',
  job: { name: 'police', label: 'Polícia', grade: 'Cabo', gradeLevel: 2, onDuty: true },
  gang: null,
  money: { cash: 150, bank: 9800.5 },
  vehicles: [
    { plate: 'ABC1234', model: 'sultan', garage: 'pillbox', state: 'GARAGED', fuel: 80, engine: 95, body: 100 },
  ],
  properties: [{ type: 'APARTMENT', name: 'Alta Street' }],
};
const discordId = '123456789012345678';
beforeEach(() => {
  vi.clearAllMocks();
  m.session.mockResolvedValue({ user: { discordId } });
});
afterEach(cleanup);

it('contrato aceita só a fonte QBCore e recusa o formato antigo', () => {
  expect(charactersSchema.safeParse({ source: 'QBCORE', slots: null, items: [character] }).success).toBe(true);
  expect(
    charactersSchema.safeParse({ source: 'REGISTERED', items: [{ citizenId: 'X', firstName: null, lastName: null }] })
      .success,
  ).toBe(false);
});

it('detalhes exibem dados reais do personagem', () => {
  render(<CharacterDetails items={[character]} />);
  for (const text of ['Ana Souza', 'ABC00001', 'Polícia · Cabo', '5551234', 'ABC1234', 'Apartamento: Alta Street'])
    expect(document.body.textContent).toContain(text);
  expect(document.body.textContent).toContain('R$');
});

it('campos indisponíveis aparecem como indisponíveis, nunca como zero ou lista vazia', () => {
  render(
    <CharacterDetails
      items={[{ ...character, money: null, job: null, phone: null, vehicles: null, properties: null }]}
    />,
  );
  expect(screen.getAllByText('Indisponível').length).toBeGreaterThanOrEqual(4);
  expect(screen.getByText('Veículos indisponíveis no momento.')).toBeTruthy();
  expect(screen.getByText('Propriedades indisponíveis no momento.')).toBeTruthy();
  expect(document.body.textContent).not.toContain('R$');
  expect(document.body.textContent).not.toContain('Nenhum veículo');
});

it('slots reais ou indisponíveis', () => {
  render(<CharacterSlots slots={{ total: 3, used: 1 }} />);
  expect(screen.getByText('1 de 3 slots em uso')).toBeTruthy();
  cleanup();
  render(<CharacterSlots slots={null} />);
  expect(screen.getByText('Quantidade de slots indisponível no momento.')).toBeTruthy();
});

it('página consulta somente o Discord da sessão', async () => {
  m.characters.mockResolvedValue({ data: { source: 'QBCORE', slots: { total: 2, used: 1 }, items: [character] } });
  render(await Characters());
  expect(m.characters).toHaveBeenCalledWith(discordId);
  expect(screen.getByText('Ana Souza')).toBeTruthy();
});

it('sem sessão redireciona ao login sem consultar a API', async () => {
  m.session.mockResolvedValue(null);
  await expect(Characters()).rejects.toThrow('NEXT_REDIRECT');
  expect(m.characters).not.toHaveBeenCalled();
});

it('vínculo ausente e indisponibilidade são estados distintos', async () => {
  m.characters.mockRejectedValue(new SiteError('PLAYER_LINK_REQUIRED', 409));
  render(await Characters());
  expect(screen.getByText('Conta ainda não vinculada.')).toBeTruthy();
  cleanup();
  m.characters.mockRejectedValue(new SiteError('API_OFFLINE', 503));
  render(await Characters());
  expect(screen.getByText(/Não foi possível consultar seus personagens agora/)).toBeTruthy();
  expect(screen.getByText('Quantidade de slots indisponível no momento.')).toBeTruthy();
});
