'use client';

import React from 'react';
import { Home, ArrowUpRight, Check, Car } from 'lucide-react';

export interface UnitTypology {
  id: string;
  name: string;
  type: 'STUDIO' | 'T2' | 'T3' | 'T5' | 'COMMERCE';
  surface: string;
  description: string;
  features: string[];
  startingPrice: string;
  badge?: string;
  availableCount: number;
}

export const TYPOLOGIES: UnitTypology[] = [
  {
    id: 'studio',
    name: 'Studio',
    type: 'STUDIO',
    surface: '≈ 25 m²',
    description: 'Idéal premier achat ou investissement locatif à haut rendement. Cuisine ouverte, salle d\'eau moderne, espace optimisé.',
    features: ['Cuisine aménagée', 'Balcon privatif', 'Accès parking pilotis'],
    startingPrice: 'Sur grille de lancement',
    availableCount: 14,
  },
  {
    id: 't2',
    name: 'Appartement T2',
    type: 'T2',
    surface: '≈ 45 m²',
    description: 'Une chambre séparée, séjour spacieux, cuisine et nombreux rangements. Parfait pour jeune couple ou pied-à-terre.',
    features: ['Chambre indépendante', 'Séjour lumineux', 'Espace bureau'],
    startingPrice: 'Sur grille de lancement',
    availableCount: 22,
  },
  {
    id: 't3',
    name: 'Appartement T3',
    type: 'T3',
    surface: '≈ 65 m²',
    description: 'Deux chambres indépendantes, vaste séjour et terrasse traversante. Le format le plus demandé par les familles.',
    features: ['2 chambres', 'Terrasse traversante', 'Suite parentale'],
    startingPrice: 'Sur grille de lancement',
    badge: 'Plus demandé',
    availableCount: 18,
  },
  {
    id: 't5',
    name: 'Appartement T5',
    type: 'T5',
    surface: '≈ 100 m²',
    description: 'Quatre chambres pour les familles nombreuses. Situé exclusivement au dernier étage des blocs C et D pour une tranquillité maximale.',
    features: ['4 chambres', 'Dernier étage (vue)', 'Double sanitaires'],
    startingPrice: 'Disponibilité limitée',
    badge: 'Dernier étage',
    availableCount: 6,
  },
  {
    id: 'commerce',
    name: 'Local Commercial',
    type: 'COMMERCE',
    surface: '≈ 50–80 m²',
    description: 'Vitrines sur rue principale (façade nord). Idéal pour pharmacie, superette, salon ou cabinet professionnel.',
    features: ['Vitrine sur rue', 'Accès livraison dédié', 'Fort passage'],
    startingPrice: 'Sur devis',
    badge: 'Façade Nord',
    availableCount: 4,
  },
];

export default function CatalogGrid({ onSelectUnit }: { onSelectUnit?: (typology: UnitTypology) => void }) {
  return (
    <section id="catalogue" className="py-20 bg-ink border-b border-paper/10 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-mono tracking-widest text-sand uppercase mb-2">
              <span className="w-4 h-[1px] bg-laterite-light" />
              Le Catalogue Officiel
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-paper">
              Du Studio au T5, un même standard de finition
            </h2>
          </div>
          <p className="text-sm font-mono text-paper/60 max-w-md">
            Finitions sobres et standardisées pour conserver des prix abordables, sans compromis sur la sécurité et le confort de la résidence fermée.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {TYPOLOGIES.map((item) => (
            <div
              key={item.id}
              className="bg-ink-card border border-paper/20 rounded-md p-6 flex flex-col justify-between hover:border-sand transition-all group relative"
            >
              {item.badge && (
                <span className="absolute top-4 right-4 text-[10px] font-mono bg-laterite/20 text-laterite-light border border-laterite/40 px-2 py-0.5 rounded">
                  {item.badge}
                </span>
              )}

              <div>
                <div className="font-serif text-2xl font-semibold text-paper mb-1">{item.name}</div>
                <div className="font-mono text-xs text-sand mb-4">{item.surface}</div>
                <p className="text-xs text-paper/70 leading-relaxed mb-6 min-h-[60px]">
                  {item.description}
                </p>

                <ul className="space-y-2 mb-6 pt-4 border-t border-paper/10 text-xs font-mono text-paper/80">
                  {item.features.map((feat, fIdx) => (
                    <li key={fIdx} className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-lagoon-light" />
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t border-paper/15">
                <div className="text-[11px] font-mono text-paper/50 uppercase">À PARTIR DE</div>
                <div className="font-mono text-sm text-laterite-light font-bold mb-4">{item.startingPrice}</div>

                <button
                  onClick={() => onSelectUnit && onSelectUnit(item)}
                  className="w-full bg-paper/10 hover:bg-laterite text-paper font-mono text-xs py-2.5 rounded transition-all flex items-center justify-center gap-1.5 group-hover:bg-laterite"
                >
                  Réserver <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
