import { redirect } from 'next/navigation';
import { currentSession } from '@/lib/auth/session';
import { serverEnv } from '@/lib/server/env';
import { ScreenPreview } from '@/components/screen/screen-preview';
import '../admin/admin.css';
import './screen.css';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Compartilhar tela — Subúrbio RP', robots: { index: false, follow: false } };

// Flag desligada ou configuração inválida: estado indisponível limpo, sem montar a UI de mídia.
function screenConfig() {
  try {
    const env = serverEnv();
    return env.LIVEKIT_ENABLED ? { maxCapacity: env.LIVEKIT_ROOM_MAX_PARTICIPANTS } : null;
  } catch {
    return null;
  }
}

export default async function ScreenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await currentSession())) {
    // Link de convite (/tela?room=CODE) preserva a sala através do login.
    const room = (await searchParams).room;
    const target = typeof room === 'string' && /^[A-F0-9]{10}$/.test(room) ? `/tela?room=${room}` : '/tela';
    redirect(`/login?returnTo=${encodeURIComponent(target)}`);
  }
  const config = screenConfig();
  if (!config)
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
      <ScreenPreview maxCapacity={config.maxCapacity} />
    </main>
  );
}
