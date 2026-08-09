'use client';

import React, { useState, useEffect } from 'react';
import { Smartphone, CheckCircle, User, LogOut } from 'lucide-react';
import { useAuth } from './AuthProvider';

export default function Navbar() {
  const [isStandalone, setIsStandalone] = useState(false);
  const { user, isLoading, logout } = useAuth();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const standalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
      const isPWA = window.matchMedia('(display-mode: standalone)').matches || (standalone ?? false);
      setIsStandalone(!!isPWA);
    }
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <nav className="sticky top-0 z-50 bg-ink/90 backdrop-blur-md border-b border-paper/15">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="font-serif text-xl font-semibold tracking-tight text-paper hover:opacity-90">
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
          <a href="/catalogue" target="_blank" rel="noopener noreferrer" className="hover:text-sand transition-colors flex items-center gap-1 font-bold text-sand">Catalogue 3D ↗</a>
          <a href="#reserver" className="hover:text-sand transition-colors">Pré-inscription</a>
        </div>

        <div className="flex items-center gap-3">
          {isLoading ? (
            <span className="font-mono text-xs text-paper/50">…</span>
          ) : user ? (
            <div className="flex items-center gap-2">
              <a
                href="/suivi"
                className="inline-flex items-center gap-1.5 font-mono text-xs border border-lagoon/40 bg-lagoon/15 text-lagoon-light px-3 py-2 rounded-sm hover:bg-lagoon/25 transition-all"
              >
                <User className="w-3.5 h-3.5" /> Suivi
              </a>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 font-mono text-xs border border-paper/30 px-3 py-2 rounded-sm hover:bg-paper/10 text-paper/80 transition-all"
              >
                <LogOut className="w-3.5 h-3.5" /> Déconnexion
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <a
                href="/login"
                className="font-mono text-xs border border-paper/30 px-4 py-2.5 rounded-sm hover:bg-paper/10 text-paper transition-all"
              >
                Connexion
              </a>
              <a
                href="#reserver"
                className="font-mono text-xs border border-paper/30 px-4 py-2.5 rounded-sm hover:bg-laterite hover:border-laterite text-paper transition-all"
              >
                Réserver ma place →
              </a>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
