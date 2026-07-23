'use client';

import React from 'react';

export default function Footer() {
  return (
    <footer className="py-12 bg-ink-dark border-t border-paper/10 text-paper/60 font-mono text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="font-serif text-base font-semibold text-paper">Terrasses<span className="text-laterite-light">·</span>Baguida</span>
          <span className="text-paper/40">| PWA v1.0</span>
        </div>
        <div className="text-center sm:text-right text-[11px] text-paper/40">
          Baguida, Lomé (Togo) — Titre Foncier RM100/71 — Prospectus non contractuel
        </div>
      </div>
    </footer>
  );
}
