'use client';

import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';

/**
 * Type pour l'event beforeinstallprompt — non declare dans lib.dom.d.ts.
 * spec : https://web.dev/articles/customize-install
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt: () => Promise<void>;
}

/**
 * Enregistre le ServiceWorker et expose deux UX :
 *   - une invitation "Installer l'application" via beforeinstallprompt
 *   - une banniere "Mise a jour disponible" quand un nouveau SW prend le relai
 *
 * Pas de token, pas de logique metier : juste la plomberie PWA cote client.
 */
export default function PWARegister() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Enregistrement SW
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        setRegistration(reg);

        // Detecter une mise a jour du SW
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Un nouveau SW est pret et attend activation
              setUpdateReady(true);
            }
          });
        });

        // Polling every 1h pour verifier une nouvelle version
        setInterval(() => reg.update(), 60 * 60 * 1000);
      } catch (err) {
        console.warn('[PWA] SW registration failed:', err);
      }
    };

    register();
  }, []);

  // Capturer l'event beforeinstallprompt (Chrome only)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice?.outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    setInstallEvent(null);
  };

  const handleApplyUpdate = () => {
    if (!registration?.waiting) return;
    // Message au SW : passe en controleur immediatement
    registration.waiting.postMessage('SKIP_WAITING');
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  };

  return (
    <>
      {/* Banniere mise a jour */}
      {updateReady && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 bg-ink-card border border-sand/40 rounded-md shadow-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-sand/20 text-sand rounded-full flex items-center justify-center shrink-0">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="font-mono text-xs text-paper/80">
                Une nouvelle version de l'application est disponible.
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleApplyUpdate}
                  className="flex-1 bg-sand hover:bg-paper text-ink font-mono text-xs py-2 rounded transition-all font-semibold"
                >
                  Mettre a jour
                </button>
                <button
                  onClick={() => setUpdateReady(false)}
                  className="px-3 border border-paper/20 hover:bg-paper/5 text-paper/60 rounded transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Banniere installation */}
      {showInstallBanner && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-40 bg-ink-card border border-laterite/40 rounded-md shadow-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-laterite/20 text-laterite-light rounded-full flex items-center justify-center shrink-0">
              <Download className="w-4 h-4" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="font-serif text-sm font-semibold text-paper">
                Installer Terrasses de Baguida
              </div>
              <div className="font-mono text-[11px] text-paper/70">
                Acces direct depuis votre ecran d'accueil, fonctionnement hors-ligne.
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleInstall}
                  className="flex-1 bg-laterite hover:bg-laterite-light text-paper font-mono text-xs py-2 rounded transition-all font-semibold"
                >
                  Installer
                </button>
                <button
                  onClick={() => setShowInstallBanner(false)}
                  className="px-3 border border-paper/20 hover:bg-paper/5 text-paper/60 rounded transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
