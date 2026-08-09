'use client';

import React, { useState } from 'react';
import { ComplexView, Unit3DDetails } from '../../lib/catalogData';
import { Layers, Eye, MapPin, Sparkles, Building, ChevronRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface ComplexOverviewViewerProps {
  views: ComplexView[];
  units: Unit3DDetails[];
  onSelectUnit: (unit: Unit3DDetails) => void;
}

export default function ComplexOverviewViewer({ views, units, onSelectUnit }: ComplexOverviewViewerProps) {
  const [activeViewId, setActiveViewId] = useState<string>(views[0]?.id || 'view-masterplan');

  const activeView = views.find((v) => v.id === activeViewId) || views[0];

  return (
    <div className="bg-ink-card border border-paper/20 rounded-xl overflow-hidden shadow-2xl">
      {/* Top Bar Navigation Tabs */}
      <div className="bg-ink/90 border-b border-paper/15 p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-mono text-sand uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5 text-laterite-light" />
            Vue d'ensemble du complexe · Baguida (RM 100/71)
          </div>
          <h2 className="font-serif text-xl sm:text-2xl font-semibold text-paper">
            {activeView.title}
          </h2>
        </div>

        {/* View Switcher Pills */}
        <div className="flex flex-wrap gap-2">
          {views.map((v) => (
            <button
              key={v.id}
              onClick={() => setActiveViewId(v.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-2 ${
                activeViewId === v.id
                  ? 'bg-laterite text-paper shadow-md font-bold'
                  : 'bg-ink/60 text-paper/70 hover:bg-paper/10 hover:text-paper border border-paper/10'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              {v.title.split('·')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Main Visual Display Area */}
      <div className="relative min-h-[420px] max-h-[600px] w-full bg-ink-dark overflow-hidden flex items-center justify-center group">
        <img
          src={activeView.imageUrl}
          alt={activeView.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent pointer-events-none" />

        {/* Interactive Hotspots Overlay (For Masterplan view) */}
        {activeView.category === 'masterplan' && activeView.hotspots && (
          <div className="absolute inset-0 pointer-events-auto">
            {activeView.hotspots.map((hs) => {
              const matchedUnit = units.find((u) => u.id === hs.targetBlockId) || units[0];
              return (
                <div
                  key={hs.id}
                  style={{ top: hs.top, left: hs.left }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
                >
                  <button
                    onClick={() => onSelectUnit(matchedUnit)}
                    className="relative group/hs flex items-center gap-2 bg-ink/90 hover:bg-laterite text-paper border-2 border-sand hover:border-paper px-3 py-1.5 rounded-full text-xs font-mono shadow-2xl transition-all hover:scale-110"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-laterite-light animate-ping absolute -left-1 -top-1" />
                    <Building className="w-3.5 h-3.5 text-sand group-hover/hs:text-paper" />
                    <span className="font-semibold">{hs.label}</span>
                    <ChevronRight className="w-3 h-3 text-sand group-hover/hs:translate-x-0.5 transition-transform" />

                    {/* Quick Preview Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover/hs:flex flex-col bg-ink border border-paper/30 p-3 rounded-lg w-56 text-left shadow-2xl pointer-events-none z-30">
                      <div className="font-serif text-sm font-semibold text-paper mb-1">{matchedUnit.name}</div>
                      <div className="text-[11px] font-mono text-sand mb-1">{matchedUnit.surfaceTotaleM2} m² · {matchedUnit.startingPriceFormatted}</div>
                      <div className="text-[10px] text-paper/70 line-clamp-2">{matchedUnit.description}</div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Description overlay bar */}
        <div className="absolute bottom-4 left-4 right-4 bg-ink/80 backdrop-blur-md border border-paper/20 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h4 className="font-serif text-sm font-semibold text-paper">{activeView.subtitle}</h4>
            <p className="text-xs text-paper/70 max-w-2xl">{activeView.description}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1 text-[11px] font-mono bg-lagoon/20 text-lagoon-light border border-lagoon/40 px-2.5 py-1 rounded">
              <ShieldCheck className="w-3.5 h-3.5" /> Titre Foncier RM 100/71
            </span>
          </div>
        </div>
      </div>

      {/* Complex Quick Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-paper/15 border-t border-paper/15 bg-ink/40 font-mono text-xs text-paper/80">
        <div className="p-3 text-center">
          <span className="text-paper/50 block text-[10px] uppercase">Terrain Globale</span>
          <span className="font-bold text-paper text-sm">6 593 m²</span>
        </div>
        <div className="p-3 text-center">
          <span className="text-paper/50 block text-[10px] uppercase">Livraison Estimée</span>
          <span className="font-bold text-sand text-sm">Trimestre 4 - 2026</span>
        </div>
        <div className="p-3 text-center">
          <span className="text-paper/50 block text-[10px] uppercase">Notaire Référant</span>
          <span className="font-bold text-paper text-sm">Étude K. Lawson</span>
        </div>
        <div className="p-3 text-center">
          <span className="text-paper/50 block text-[10px] uppercase">Garantie Vente</span>
          <span className="font-bold text-lagoon-light text-sm">Compte Séquestre</span>
        </div>
      </div>
    </div>
  );
}
