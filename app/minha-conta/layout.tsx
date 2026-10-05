import { redirect } from 'next/navigation';
import { currentSession } from '@/lib/auth/session';
import { publicProfile } from '@/lib/public-profile';
import { AccountShell } from '@/components/account/account-shell';
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await currentSession();
  if (!session) redirect('/login?returnTo=/minha-conta');
  return <AccountShell user={publicProfile(session.user)!}>{children}</AccountShell>;
}
