import type { Metadata, Viewport } from 'next';
import './globals.css';
import React from 'react';
import PWARegister from '../components/PWARegister';
import SourceCapture from '../components/SourceCapture';
import { AuthProvider } from '../components/AuthProvider';

export const metadata: Metadata = {
  title: "Les Terrasses de Baguida — Projet à l'étude",
  description:
    "Un projet d'appartements à Baguida, Lomé (Togo). Donnez votre avis en 2 minutes : les réponses orientent les typologies, les prix et les plans. Sans engagement, sans paiement.",
  manifest: '/manifest.json',
  applicationName: 'Les Terrasses de Baguida',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Les Terrasses de Baguida',
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
    title: "Les Terrasses de Baguida — Projet à l'étude",
    description:
      "Appartements à Baguida, Lomé (Togo). Projet à l'étude, prix et plans indicatifs. Donnez votre avis en 2 minutes.",
    siteName: 'Les Terrasses de Baguida',
    type: 'website',
    locale: 'fr_FR',
  },
};

export const viewport: Viewport = {
  themeColor: '#FBF7EF',
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
      <body className="bg-cream text-body font-sans antialiased">
        <SourceCapture />
        <AuthProvider>
          {children}
        </AuthProvider>
        <PWARegister />
      </body>
    </html>
  );
}
