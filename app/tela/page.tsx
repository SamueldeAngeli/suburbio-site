import { redirect } from 'next/navigation';
import { currentSession } from '@/lib/auth/session';
import { serverEnv } from '@/lib/server/env';
import { ScreenPreview } from '@/components/screen/screen-preview';
import '../admin/admin.css';
import './screen.css';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Transmissões — Subúrbio RP', robots: { index: false, follow: false } };

// Flag desligada ou configuração inválida: estado indisponível limpo, sem montar a UI de mídia.
function screenEnabled() {
  try {
    return serverEnv().LIVEKIT_ENABLED === true;
  } catch {
    return false;
  }
}

export default async function ScreenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await currentSession())) {
    // Link de transmissão (/tela?room=CODE[&invite=KEY]) preserva sala e convite através do login.
    const { room, invite } = await searchParams;
    const code = typeof room === 'string' && /^[A-F0-9]{10}$/.test(room) ? room : null;
    const key = typeof invite === 'string' && /^[a-f0-9]{32}$/.test(invite) ? invite : null;
    const target = code ? `/tela?room=${code}${key ? `&invite=${key}` : ''}` : '/tela';
    redirect(`/login?returnTo=${encodeURIComponent(target)}`);
  }
  if (!screenEnabled())
    return (
      <main className="admin-root">
        <section className="screen-unavailable" role="status">
          <span className="admin-kicker">SUBÚRBIO / TELA</span>
          <h1>Transmissão indisponível</h1>
          <p>O compartilhamento de tela está temporariamente desativado. Tente novamente mais tarde.</p>
        </section>
      </main>
    );
  return (
    <main className="admin-root">
      <ScreenPreview />
    </main>
  );
}
