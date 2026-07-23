import type { Metadata, Viewport } from 'next';
import './globals.css';
import React from 'react';
import PWARegister from '../components/PWARegister';

export const metadata: Metadata = {
  title: 'Les Terrasses de Baguda — Réservez avant le lancement',
  description: 'Studios, T2, T3 et T5 en résidence fermée à Baguida, Lomé (Togo). Réservez votre logement financé avant construction.',
  manifest: '/manifest.json',
  applicationName: 'Terrasses de Baguda',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Terrasses Baguida',
  },
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
    ],
    apple: [{ url: '/apple-touch-icon.svg', sizes: '180x180', type: 'image/svg+xml' }],
    shortcut: ['/favicon.svg'],
  },
  openGraph: {
    title: 'Les Terrasses de Baguda — Résidence Catalog PWA',
    description: 'Logements en résidence fermée à Lomé, Togo. Réservez en ligne avec garantie de pré-financement.',
    siteName: 'Terrasses de Baguda',
    type: 'website',
    locale: 'fr_FR',
  },
};

export const viewport: Viewport = {
  themeColor: '#152238',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.svg" />
      </head>
      <body className="bg-ink text-paper font-sans antialiased selection:bg-laterite selection:text-paper">
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
