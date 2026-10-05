import { redirect } from 'next/navigation';
import { currentSession } from '@/lib/auth/session';
import { ScreenPreview } from '@/components/screen/screen-preview';
import '../admin/admin.css';
import './screen.css';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Compartilhar tela — Subúrbio RP', robots: { index: false, follow: false } };
export default async function ScreenPage() {
  if (!(await currentSession())) redirect('/login?returnTo=/tela');
  return (
    <main className="admin-root">
      <ScreenPreview />
    </main>
  );
}
