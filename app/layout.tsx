import './globals.css';
import type { Metadata, Viewport } from 'next';
import AppChrome from '@/components/AppChrome';

export const metadata: Metadata = {
  title: 'CaissePro — Gestion de Caisse & Flotte',
  description:
    'Application de gestion de caisse chauffeurs, billetterie, rapprochement et suivi multi-caisses',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0F172A',
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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
