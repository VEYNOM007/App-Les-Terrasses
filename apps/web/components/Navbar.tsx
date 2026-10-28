'use client';

import React, { useState } from 'react';
import { User, LogOut, ShieldCheck, Menu, X, ArrowRight } from 'lucide-react';
import { useAuth } from './AuthProvider';
import Brand from './Brand';
import { MARKET_STUDY_MODE, SURVEY_PATH } from '../lib/market-mode';

const PUBLIC_LINKS = [
  { href: '/#projet', label: 'Le projet' },
  { href: '/catalogue', label: 'Catalogue 3D' },
  { href: '/#avis', label: 'Votre avis' },
] as const;

interface NavbarProps {
  /** light = fond crème (site public) ; dark = back-office inchangé. */
  variant?: 'light' | 'dark';
}

export default function Navbar({ variant = 'light' }: NavbarProps) {
  const { user, isLoading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const dark = variant === 'dark';

  const shell = dark
    ? 'bg-ink/90 border-paper/15 text-paper'
    : 'bg-cream/90 border-line text-ink';
  const linkClass = dark
    ? 'text-paper/75 hover:text-sand'
    : 'text-ink/70 hover:text-laterite';
  const secondaryButton = dark
    ? 'border-paper/30 text-paper hover:bg-paper/10'
    : 'border-ink/15 text-ink hover:border-ink/30 hover:bg-ink/5';

  const ctaHref = MARKET_STUDY_MODE ? SURVEY_PATH : '/catalogue';
  const ctaLabel = MARKET_STUDY_MODE ? 'Donnez votre avis' : 'Réserver ma place';

  return (
    <nav
      className={`sticky top-0 z-50 border-b backdrop-blur-md ${shell}`}
      aria-label="Navigation principale"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <a href="/" className="shrink-0 hover:opacity-90" aria-label="Accueil">
          <Brand compact variant={dark ? 'onDark' : 'onLight'} />
        </a>

        {/* Liens desktop */}
        <div className="hidden items-center gap-7 text-sm md:flex">
          {PUBLIC_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`transition-colors ${linkClass} ${
                item.href === '/catalogue' ? 'font-semibold' : 'font-medium'
              }`}
            >
              {item.label}
            </a>
          ))}
        </div>

        {/* Actions desktop */}
        <div className="hidden items-center gap-2 md:flex">
          {isLoading ? (
            <span className={`font-mono text-xs ${dark ? 'text-paper/50' : 'text-muted'}`}>…</span>
          ) : user ? (
            <>
              <span
                className={`hidden max-w-[150px] truncate font-mono text-xs lg:inline ${
                  dark ? 'text-paper/60' : 'text-muted'
                }`}
                title={user.email}
              >
                {user.fullName || user.email}
              </span>
              {user.role === 'ADMIN' && (
                <a
                  href="/admin"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-laterite/40 bg-laterite/10 px-3 py-2 font-mono text-xs text-laterite transition-colors hover:bg-laterite/20"
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> Admin
                </a>
              )}
              <a
                href="/suivi"
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 font-mono text-xs transition-colors ${secondaryButton}`}
              >
                <User className="h-3.5 w-3.5" /> Suivi
              </a>
              <button
                onClick={() => void logout()}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 font-mono text-xs transition-colors ${secondaryButton}`}
                aria-label="Déconnexion"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <a
              href="/login"
              className={`rounded-lg border px-3 py-2.5 font-mono text-xs transition-colors ${secondaryButton}`}
            >
              Connexion
            </a>
          )}

          <a href={ctaHref} className="btn-primary !px-4 !py-2.5 !text-xs">
            {ctaLabel} <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Actions mobile */}
        <div className="flex items-center gap-2 md:hidden">
          <a href={ctaHref} className="btn-primary !px-4 !py-2.5 !text-xs">
            {MARKET_STUDY_MODE ? 'Avis' : 'Réserver'}
          </a>
          <button
            onClick={() => setMobileOpen((open) => !open)}
            className={`rounded-lg border p-2.5 transition-colors ${secondaryButton}`}
            aria-expanded={mobileOpen}
            aria-controls="menu-mobile"
            aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Panneau mobile */}
      {mobileOpen && (
        <div id="menu-mobile" className={`border-t md:hidden ${dark ? 'border-paper/10' : 'border-line'}`}>
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {PUBLIC_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                  dark ? 'text-paper/80 hover:bg-paper/10' : 'text-ink/80 hover:bg-ink/5'
                }`}
              >
                {item.label}
              </a>
            ))}
            <div className={`my-2 border-t ${dark ? 'border-paper/10' : 'border-line'}`} />
            {user ? (
              <>
                {user.role === 'ADMIN' && (
                  <a
                    href="/admin"
                    onClick={() => setMobileOpen(false)}
                    className={`rounded-lg px-3 py-3 text-sm font-medium ${
                      dark ? 'text-paper/80 hover:bg-paper/10' : 'text-ink/80 hover:bg-ink/5'
                    }`}
                  >
                    Espace promoteur
                  </a>
                )}
                <a
                  href="/suivi"
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-lg px-3 py-3 text-sm font-medium ${
                    dark ? 'text-paper/80 hover:bg-paper/10' : 'text-ink/80 hover:bg-ink/5'
                  }`}
                >
                  Mon suivi
                </a>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    void logout();
                  }}
                  className={`rounded-lg px-3 py-3 text-left text-sm font-medium ${
                    dark ? 'text-paper/60 hover:bg-paper/10' : 'text-muted hover:bg-ink/5'
                  }`}
                >
                  Déconnexion
                </button>
              </>
            ) : (
              <a
                href="/login"
                onClick={() => setMobileOpen(false)}
                className={`rounded-lg px-3 py-3 text-sm font-medium ${
                  dark ? 'text-paper/80 hover:bg-paper/10' : 'text-ink/80 hover:bg-ink/5'
                }`}
              >
                Connexion
              </a>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
