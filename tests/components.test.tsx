import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
vi.mock('next/navigation', () => ({ usePathname: () => '/admin/services', useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/auth/actions', () => ({ logout: vi.fn() }));
import { AdminShell } from '@/components/admin/shell';
import { AccessUnavailable, GapState, PanelSkeleton } from '@/components/admin/states';
import { RevokeForm } from '@/components/admin/revoke-form';
import { adminModules } from '@/lib/admin/modules';
describe('Componentes críticos e limites client/server', () => {
  it('shell renderiza navegação autorizada, identidade e logout', () => {
    const module = adminModules.find((m) => m.slug === 'services')!;
    const html = renderToStaticMarkup(
      <AdminShell modules={[{ ...module, iconIndex: 12 }]} name="Teste" owner>
        <div>Conteúdo</div>
      </AdminShell>,
    );
    expect(html).toContain('SYSTEM_OWNER');
    expect(html).toContain('Sair da conta');
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain('href="/admin/payments"');
  });
  it('navegação mobile tem controle com nome e estado acessíveis', () => {
    const html = renderToStaticMarkup(
      <AdminShell modules={[]} name="Teste" owner={false}>
        Conteúdo
      </AdminShell>,
    );
    expect(html).toContain('aria-label="Abrir navegação"');
    expect(html).toContain('aria-expanded="false"');
    const css = readFileSync('app/admin/admin.css', 'utf8');
    expect(css).toMatch(/@media\s*\(max-width:\s*800px\)/);
    expect(css).toContain('prefers-reduced-motion');
  });
  it('estado de gap não inventa métricas', () => {
    const html = renderToStaticMarkup(<GapState />);
    expect(html).toContain('Dados ainda não integrados');
    expect(html).not.toMatch(/R\$|Online|100 jogadores/);
  });
  it('acesso não resolvido não contém menus administrativos', () => {
    const html = renderToStaticMarkup(<AccessUnavailable />);
    expect(html).toContain('Aguardando autorização');
    expect(html).not.toContain('/admin/players');
  });
  it('skeleton informa estado de carregamento', () =>
    expect(renderToStaticMarkup(<PanelSkeleton />)).toContain('aria-label="Carregando módulo"'));
  it('revogação desabilitada não oferece submissão imediata', () => {
    const html = renderToStaticMarkup(<RevokeForm playerId="test" disabled />);
    expect(html).toContain('disabled');
    expect(html).toContain('Confirmo a revogação');
    expect(html).toContain('textarea');
  });
  it('módulos de secrets marcam fronteira server-only', () => {
    for (const path of ['auth.ts', 'lib/server/env.ts', 'lib/api/client.ts', 'lib/api/hmac.ts'])
      expect(readFileSync(path, 'utf8')).toContain("import 'server-only'");
  });
  it('client público não importa auth/env e não contém owner hardcoded', () => {
    const page = readFileSync('app/page.tsx', 'utf8');
    expect(page).not.toMatch(/SITE_SERVICE_SECRET|DISCORD_CLIENT_SECRET|403707367885242378|lib\/server|@\/auth/);
  });
});
