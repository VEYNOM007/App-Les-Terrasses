'use client';

import React from 'react';
import Brand from './Brand';
import { MARKET_STUDY_MODE, MARKET_STUDY_NOTICE } from '../lib/market-mode';

const PROJECT_LINKS = [
  { href: '/#projet', label: 'Le projet' },
  { href: '/catalogue', label: 'Catalogue 3D' },
  { href: '/#avis', label: 'Donnez votre avis' },
] as const;

export default function Footer() {
  return (
    <footer className="bg-ink text-paper/70">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <Brand variant="onDark" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-paper/70">
              Des appartements pensés pour Lomé et pour la diaspora, à Baguida.
              Le projet est à l&apos;étude : votre avis oriente les typologies,
              les prix et les plans.
            </p>
            {MARKET_STUDY_MODE && (
              <p className="mt-4 inline-flex rounded-lg border border-laterite-light/30 bg-laterite/15 px-3 py-2 text-xs font-medium text-laterite-light">
                {MARKET_STUDY_NOTICE}
              </p>
            )}
          </div>

          <div>
            <h2 className="eyebrow text-sand">Le projet</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {PROJECT_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="transition-colors hover:text-paper">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="eyebrow text-sand">Contact</h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <a
                  href="mailto:immo.les.terrasses@gmail.com"
                  className="break-all transition-colors hover:text-paper"
                >
                  immo.les.terrasses@gmail.com
                </a>
              </li>
              <li>
                <a href="/confidentialite" className="transition-colors hover:text-paper">
                  Confidentialité des données
                </a>
              </li>
              <li>
                <a href="/admin/catalogue" className="transition-colors hover:text-paper">
                  Espace promoteur
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-paper/15 pt-6 text-xs text-paper/45 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Les Terrasses de Baguida · Baguida, Lomé (Togo)</p>
          <p>Prospectus non contractuel</p>
        </div>
      </div>
    </footer>
  );
}
