import React from 'react';
import { WifiOff, RefreshCw, Home } from 'lucide-react';

// Page statique 100% server-rendered, aucun handler JS.
// Elle est precachee par /public/sw.js pour servir de fallback hors-ligne.

export const metadata = {
  title: 'Hors-ligne — Terrasses de Baguida',
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-ink text-paper flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 mx-auto bg-laterite/15 text-laterite-light rounded-full flex items-center justify-center border border-laterite/40">
          <WifiOff className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <h1 className="font-serif text-3xl font-semibold text-paper">Vous etes hors-ligne</h1>
          <p className="font-mono text-sm text-paper/70 leading-relaxed">
            Certaines pages sont deja en cache et accessibles.
            Reconnectez-vous pour retrouver l'integralite du catalogue
            et du suivi chantier.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <a
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-laterite hover:bg-laterite-light text-paper font-mono text-sm px-6 py-3 rounded transition-all"
          >
            <RefreshCw className="w-4 h-4" /> Reessayer
          </a>
          <a
            href="/"
            className="inline-flex items-center justify-center gap-2 border border-paper/30 hover:border-sand text-paper font-mono text-sm px-6 py-3 rounded transition-all"
          >
            <Home className="w-4 h-4" /> Accueil
          </a>
        </div>

        <p className="font-mono text-[11px] text-paper/45 pt-6 border-t border-paper/10">
          Terrasses de Baguida — la reservation en ligne reste disponible
          des que la connexion revient.
        </p>
      </div>
    </main>
  );
}
