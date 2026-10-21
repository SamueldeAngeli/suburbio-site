// @vitest-environment jsdom
import { it, expect, vi, afterEach, describe } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
const m = vi.hoisted(() => ({ adminList: vi.fn(), access: vi.fn() }));
vi.mock('@/lib/api/client', () => ({
  SuburbioApiClient: class {
    adminList = m.adminList;
  },
}));
vi.mock('@/lib/permissions/guards', () => ({ pageAccess: m.access }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));
import { DataList, ModulePage } from '@/components/admin/module-page';
import { actionLabel, adminLists, formatCell } from '@/lib/admin/lists';
import { capabilityGroups } from '@/lib/admin/capabilities';
import { SiteError } from '@/lib/api/errors';

const actor = '123456789012345678';
const query = { page: 1, pageSize: 20, q: '', status: '', from: '', to: '' };
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('formatação', () => {
  it('dinheiro em centavos, datas em Brasília, estados traduzidos e IDs curtos', () => {
    expect(formatCell({ v: '3980', currency: 'BRL' }, { key: 'v', label: '', format: 'money' })).toMatch(/R\$\s?39,80/);
    expect(formatCell({ v: '150', c: 'CRYPTO' }, { key: 'v', label: '', format: 'money', currencyKey: 'c' })).toBe(
      '150 CRYPTO',
    );
    expect(formatCell({ v: '2026-10-20T15:00:00.000Z' }, { key: 'v', label: '', format: 'date' })).toBe(
      '20/10/2026, 12:00',
    );
    expect(formatCell({ v: 'pending' }, { key: 'v', label: '', format: 'status' })).toBe('Pendente');
    expect(formatCell({ v: 'algo_novo' }, { key: 'v', label: '', format: 'status' })).toBe('algo_novo');
    expect(formatCell({ v: '0f3e1a2b-0000-4000-8000-000000000000' }, { key: 'v', label: '', format: 'id' })).toBe(
      '0f3e1a2b…',
    );
    expect(formatCell({ v: null }, { key: 'v', label: '' })).toBe('—');
  });
  it('códigos internos viram texto: ações, nível, expiração e license', () => {
    expect(actionLabel('allowlist.revoked')).toBe('Revogação · Allowlist');
    expect(actionLabel('admin.owner.bootstrapped')).toBe('Definição inicial · Dono');
    expect(actionLabel('system-bootstrap')).toBe('Instalação inicial');
    expect(formatCell({ v: 'SYSTEM_OWNER' }, { key: 'v', label: '', format: 'level' })).toBe('Dono do sistema');
    expect(formatCell({ v: '2147483647' }, { key: 'v', label: '', format: 'unix' })).toBe('Permanente');
    expect(formatCell({ v: 'license:628e4c22aabbccdd' }, { key: 'v', label: '', format: 'id' })).toBe('628e4c22…');
    expect(capabilityGroups(['PLAYERS_READ', 'PLAYERS_MANAGE', 'ADMIN_PERMISSIONS_MANAGE'])).toEqual([
      { area: 'Jogadores', actions: ['ver', 'gerenciar'] },
      { area: 'Permissões de admins', actions: ['gerenciar'] },
    ]);
  });
});

describe('listas do admin', () => {
  it('pedidos: mostra as linhas reais da API e paginação', async () => {
    m.adminList.mockResolvedValue({
      data: {
        items: [
          {
            id: '0f3e1a2b-0000-4000-8000-000000000000',
            customerDiscordId: '777777777777777777',
            items: 'Rádio ×2',
            amountMinor: '3980',
            currency: 'BRL',
            paymentStatus: 'approved',
            deliveryStatus: 'pending',
            createdAt: '2026-10-20T15:00:00.000Z',
          },
        ],
        page: 1,
        pageSize: 25,
        total: 30,
        asOf: '2026-10-20T15:00:00.000Z',
      },
    });
    render(await DataList({ slug: 'orders', title: 'Pedidos', config: adminLists.orders, actor, query }));
    expect(m.adminList).toHaveBeenCalledWith(actor, 'orders', query);
    expect(screen.getByText('Rádio ×2')).toBeTruthy();
    expect(screen.getByText('Aprovado')).toBeTruthy();
    expect(screen.getByText('30 registros')).toBeTruthy();
    expect(screen.getByText('Página 1 de 2')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Próxima' }).getAttribute('href')).toBe('/admin/orders?page=2');
    expect(screen.queryByText(/Aguardando integração/)).toBeNull();
  });
  it('lista vazia mostra mensagem própria, sem dados inventados', async () => {
    m.adminList.mockResolvedValue({
      data: { items: [], page: 1, pageSize: 25, total: 0, asOf: '2026-10-20T15:00:00Z' },
    });
    render(await DataList({ slug: 'refunds', title: 'Reembolsos', config: adminLists.refunds, actor, query }));
    expect(screen.getByText('Nenhum reembolso registrado.')).toBeTruthy();
  });
  it('erro da API vira aviso com referência, sem detalhes internos', async () => {
    m.adminList.mockRejectedValue(new SiteError('API_OFFLINE', 503));
    render(await DataList({ slug: 'audit', title: 'Auditoria', config: adminLists.audit, actor, query }));
    expect(document.body.textContent).toMatch(/OP-/);
    expect(document.body.textContent).not.toMatch(/stack|127\.0\.0\.1|SQL/);
  });
  it('configurações: sem endpoint, explica que não há dados em vez de fingir integração', async () => {
    m.access.mockResolvedValue({ discordId: actor });
    render(await ModulePage({ slug: 'settings', searchParams: Promise.resolve({}) }));
    expect(screen.getByText('Sem dados para exibir')).toBeTruthy();
    expect(m.adminList).not.toHaveBeenCalled();
  });
  it('cada tela com dados tem uma lista configurada', () => {
    for (const slug of [
      'orders',
      'payments',
      'refunds',
      'chargebacks',
      'audit',
      'punishments',
      'permissions',
      'discord',
    ])
      expect(adminLists[slug]).toBeTruthy();
  });
});
