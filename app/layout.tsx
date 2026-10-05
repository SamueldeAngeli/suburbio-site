import type { Metadata } from 'next';
import './globals.css';
import './citizen.css';
import { CitizenProvider } from '@/components/site/citizen-provider';
import { SiteHeader } from '@/components/site/site-header';
export const metadata: Metadata = {
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
