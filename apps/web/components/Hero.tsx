'use client';

import React from 'react';
import { ArrowRight, ShieldCheck, MapPin, Building } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative pt-16 pb-20 bg-gradient-to-b from-ink via-ink to-ink-dark overflow-hidden border-b border-paper/10">
      {/* Radial ambient glow */}
      <div className="absolute top-0 right-0 w-[600px] h-[500px] bg-lagoon/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 text-xs font-mono tracking-widest text-sand uppercase">
              <span className="w-5 h-[1px] bg-laterite-light inline-block" />
              Pré-lancement — Baguida, Lomé (Togo)
            </div>

            <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-semibold text-paper leading-[1.1]">
              Un logement <em className="italic text-laterite-light">financé avant</em> le premier coup de pioche.
            </h1>

            <p className="text-base sm:text-lg text-paper/80 max-w-2xl leading-relaxed">
              Studios, T2, T3 et T5 en résidence fermée sécurisée, à quelques minutes du littoral de Baguida. Réservez votre logement en ligne — nous ne construisons que ce qui est déjà financé par pré-ventes.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <a
                href="#reserver"
                className="bg-laterite hover:bg-laterite-light text-paper font-mono text-sm px-6 py-3.5 rounded-sm inline-flex items-center gap-2 transition-all shadow-lg hover:-translate-y-0.5"
              >
                Réserver ma place <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="#masterplan"
                className="border border-paper/30 hover:border-sand hover:bg-paper/5 text-paper font-mono text-sm px-6 py-3.5 rounded-sm transition-all"
              >
                Explorer le plan de masse
              </a>
            </div>

            <div className="pt-6 grid grid-cols-3 gap-4 border-t border-paper/15 font-mono">
              <div className="border-l border-paper/30 pl-3">
                <span className="text-xl font-bold text-paper block">6 593 m²</span>
                <span className="text-[11px] text-paper/60 uppercase tracking-wider">Surface du terrain</span>
              </div>
              <div className="border-l border-paper/30 pl-3">
                <span className="text-xl font-bold text-paper block">3 Façades</span>
                <span className="text-[11px] text-paper/60 uppercase tracking-wider">Voies d'accès</span>
              </div>
              <div className="border-l border-paper/30 pl-3">
                <span className="text-xl font-bold text-sand block">RM 100/71</span>
                <span className="text-[11px] text-paper/60 uppercase tracking-wider">Titre Foncier</span>
              </div>
            </div>
          </div>

          {/* Blueprint SVG Preview Card */}
          <div className="lg:col-span-5">
            <div className="bg-ink-card border border-paper/30 rounded-md p-6 shadow-2xl relative">
              <div className="flex justify-between items-baseline font-mono text-xs text-paper/60 mb-4 pb-2 border-b border-paper/15">
                <span>PLAN DE BORNAGE · <b className="text-sand font-normal">RM 100/71</b></span>
                <span>ÉCH. 1/1000</span>
              </div>

              <svg id="heroPlotSvg" viewBox="0 0 400 280" className="w-full h-auto block">
                <g className="plot-grid">
                  <line x1="0" y1="50" x2="400" y2="50" />
                  <line x1="0" y1="110" x2="400" y2="110" />
                  <line x1="0" y1="170" x2="400" y2="170" />
                  <line x1="0" y1="230" x2="400" y2="230" />
                  <line x1="80" y1="0" x2="80" y2="280" />
                  <line x1="160" y1="0" x2="160" y2="280" />
                  <line x1="240" y1="0" x2="240" y2="280" />
                  <line x1="320" y1="0" x2="320" y2="280" />
                </g>
                <polygon className="plot-outline" points="58,62 336,54 344,214 66,226" />
                <circle className="plot-pt" cx="58" cy="62" r="3" style={{ animationDelay: '0.8s' }} />
                <text className="plot-pt-label" x="66" y="58" style={{ animationDelay: '0.8s' }}>B1</text>
                <circle className="plot-pt" cx="336" cy="54" r="3" style={{ animationDelay: '1.0s' }} />
                <text className="plot-pt-label" x="322" y="46" style={{ animationDelay: '1.0s' }}>B2</text>
                <circle className="plot-pt" cx="344" cy="214" r="3" style={{ animationDelay: '1.2s' }} />
                <text className="plot-pt-label" x="350" y="218" style={{ animationDelay: '1.2s' }}>B3</text>
                <circle className="plot-pt" cx="66" cy="226" r="3" style={{ animationDelay: '1.4s' }} />
                <text className="plot-pt-label" x="34" y="230" style={{ animationDelay: '1.4s' }}>B4</text>
                <text className="font-mono text-[10px] fill-paper/60" x="355" y="24">N ↑</text>
                <text className="font-mono text-[9px] fill-paper/50" x="16" y="24">Voie publique</text>
                <text className="font-mono text-[9px] fill-paper/50" x="16" y="272">Voie publique</text>
              </svg>

              <div className="mt-4 pt-3 border-t border-paper/15 flex flex-wrap gap-4 font-mono text-[11px] text-paper/70">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-laterite-light inline-block" />
                  Limite propriété
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-lagoon inline-block" />
                  Lots en commercialisation
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-sand inline-block" />
                  Façade commerciale
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
