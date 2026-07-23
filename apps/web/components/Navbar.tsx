'use client';

import React, { useState, useEffect } from 'react';
import { Smartphone, CheckCircle } from 'lucide-react';

export default function Navbar() {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      setIsStandalone(!!isPWA);
    }
  }, []);

  return (
    <nav className="sticky top-0 z-50 bg-ink/90 backdrop-blur-md border-b border-paper/15">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="#" className="font-serif text-xl font-semibold tracking-tight text-paper hover:opacity-90">
            Terrasses<span className="text-laterite-light">·</span>Baguida
          </a>
          {isStandalone && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono bg-lagoon/20 text-lagoon-light border border-lagoon/40 rounded">
              <Smartphone className="w-3 h-3" /> PWA Active
            </span>
          )}
        </div>

        <div className="hidden md:flex items-center gap-6 text-sm font-mono text-paper/80">
          <a href="#mecanisme" className="hover:text-sand transition-colors">Le mécanisme</a>
          <a href="#masterplan" className="hover:text-sand transition-colors">Plan de masse</a>
          <a href="#catalogue" className="hover:text-sand transition-colors">Catalogue</a>
          <a href="#reserver" className="hover:text-sand transition-colors">Pré-inscription</a>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="#reserver"
            className="font-mono text-xs border border-paper/30 px-4 py-2.5 rounded-sm hover:bg-laterite hover:border-laterite text-paper transition-all"
          >
            Réserver ma place →
          </a>
        </div>
      </div>
    </nav>
  );
}
