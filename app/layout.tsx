import type { Metadata } from 'next';
import './globals.css';
import './citizen.css';
import { CitizenProvider } from '@/components/site/citizen-provider';
import { SiteHeader } from '@/components/site/site-header';
import { canonicalOrigin } from '@/lib/canonical';
import { serverEnv } from '@/lib/server/env';

// URLs absolutas de metadata usam a origem canônica (AUTH_URL), nunca localhost nem www.
function metadataBase() {
  try {
    return canonicalOrigin(serverEnv().AUTH_URL) ?? undefined;
  } catch {
    return undefined;
  }
}
export const metadata: Metadata = {
  metadataBase: metadataBase(),
  title: 'Subúrbio RP — Da quebrada pro mundo',
  description:
    'Sua história começa no Subúrbio. Conheça a cidade, encontre seu caminho e explore os planos e benefícios da Área VIP.',
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-motion="on">
      <body>
        <CitizenProvider>
          <SiteHeader />
          {children}
        </CitizenProvider>
      </body>
    </html>
  );
}
