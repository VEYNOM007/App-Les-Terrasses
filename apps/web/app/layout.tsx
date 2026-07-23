import type { Metadata, Viewport } from 'next';
import './globals.css';
import React from 'react';

export const metadata: Metadata = {
  title: 'Les Terrasses de Baguida — Réservez avant le lancement',
  description: 'Studios, T2, T3 et T5 en résidence fermée à Baguida, Lomé (Togo). Réservez votre logement financé avant construction.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Terrasses Baguida',
  },
  openGraph: {
    title: 'Les Terrasses de Baguida — Résidence Catalog PWA',
    description: 'Logements en résidence fermée à Lomé, Togo. Réservez en ligne avec garantie de pré-financement.',
    siteName: 'Terrasses de Baguida',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#152238',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
      </head>
      <body className="bg-ink text-paper font-sans antialiased selection:bg-laterite selection:text-paper">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('PWA ServiceWorker registered with scope: ', registration.scope);
                    },
                    function(err) {
                      console.log('PWA ServiceWorker registration failed: ', err);
                    }
                  );
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
