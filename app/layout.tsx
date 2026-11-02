import './globals.css';
import type { Metadata, Viewport } from 'next';
import AppChrome from '@/components/AppChrome';

export const metadata: Metadata = {
  title: 'Caisse Chauffeurs — Gestion & Recettes',
  description: 'Système complet de caisse, billetterie et suivi des mouvements de chauffeurs',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#4f46e5',
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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}

