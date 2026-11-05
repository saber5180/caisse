import './globals.css';
import type { Metadata, Viewport } from 'next';
import AppChrome from '@/components/AppChrome';

export const metadata: Metadata = {
  title: 'CaissePro — Trésorerie, Flotte & Billetterie',
  description:
    'Plateforme Enterprise de gestion de caisse chauffeurs, billetterie, rapprochement financier et facturation multi-comptes',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0B0F19',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
