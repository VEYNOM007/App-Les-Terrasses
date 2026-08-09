'use client';

import React, { useState } from 'react';
import { ComplexView, Unit3DDetails } from '../../lib/catalogData';
import {
  Layers,
  Eye,
  MapPin,
  Sparkles,
  Building,
  ChevronRight,
  ShieldCheck,
  Compass,
  CheckCircle2,
  TreePine,
  Car,
  DoorOpen
} from 'lucide-react';

interface ComplexOverviewViewerProps {
  views: ComplexView[];
  units: Unit3DDetails[];
  onSelectUnit: (unit: Unit3DDetails) => void;
}

export default function ComplexOverviewViewer({ views, units, onSelectUnit }: ComplexOverviewViewerProps) {
  const [activeViewId, setActiveViewId] = useState<string>(views[0]?.id || 'view-masterplan');

  const activeView = views.find((v) => v.id === activeViewId) || views[0];

  return (
    <div className="bg-ink-card border border-paper/20 rounded-2xl overflow-hidden shadow-2xl">
      {/* Top Navigation Bar & Tabs */}
      <div className="bg-ink/95 border-b border-paper/15 p-4 sm:p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-mono text-sand uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4 text-laterite-light" />
            Vue d'ensemble du complexe · Titre Foncier RM 100/71 (6 593 m²)
          </div>
          <h2 className="font-serif text-xl sm:text-2xl font-semibold text-paper">
            {activeView.title}
          </h2>
        </div>

        {/* View Switcher Buttons */}
        <div className="flex flex-wrap gap-2">
          {views.map((v) => {
            const isActive = activeViewId === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setActiveViewId(v.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-mono transition-all flex items-center gap-2 ${
                  isActive
                    ? 'bg-laterite text-paper shadow-lg font-bold border border-laterite-light'
                    : 'bg-ink/70 text-paper/70 hover:bg-paper/10 hover:text-paper border border-paper/15'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                {v.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* VIEW DISPLAY AREA */}
      {activeView.id === 'view-masterplan' ? (
        /* ARCHITECTURAL VECTOR MASTER PLAN BLUEPRINT */
        <div className="relative w-full bg-[#0E1726] p-4 sm:p-8 overflow-hidden flex flex-col items-center justify-center border-b border-paper/10">
          {/* Blueprint Grid background */}
          <div className="absolute inset-0 bg-[radial-gradient(#5A6E8C_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

          {/* Master Plan Card Container */}
          <div className="relative w-full max-w-5xl bg-ink-card/90 border-2 border-sand/40 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-6">
            {/* Header info bar */}
            <div className="flex justify-between items-center border-b border-paper/15 pb-3 font-mono text-xs text-paper/70">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-sand animate-pulse" />
                <span className="font-bold text-sand">PLAN DE MASSE ARCHITECTURAL · ÉCHELE 1/500</span>
              </div>
              <span className="bg-sand/10 text-sand border border-sand/30 px-2.5 py-0.5 rounded text-[11px]">
                NORD ↑
              </span>
            </div>

            {/* Architectural Layout Representation */}
            <div className="relative space-y-4">
              {/* RUE PÉRIPHÉRIQUE NORD & BOUTIQUES */}
              <div className="bg-ink/80 border border-sand/30 rounded-xl p-3 text-center space-y-2">
                <div className="text-[11px] font-mono text-sand uppercase tracking-wider flex items-center justify-center gap-2">
                  <Car className="w-3.5 h-3.5" /> RUE PÉRIPHÉRIQUE NORD · BOUTIQUES & PARKING CLIENTS (6m de large)
                </div>

                <div className="flex justify-center">
                  {(() => {
                    const matchedUnit = units.find((u) => u.id === 'unit-commerce') || units[0];
                    return (
                      <button
                        onClick={() => onSelectUnit(matchedUnit)}
                        className="bg-sand/20 hover:bg-sand/30 text-sand border border-sand/50 px-4 py-2 rounded-lg text-xs font-mono font-bold flex items-center gap-2 transition-all hover:scale-105"
                      >
                        <Building className="w-4 h-4" /> FAÇADE BOUTIQUES (10 Boutiques) →
                      </button>
                    );
                  })()}
                </div>
              </div>

              {/* MAIN RESIDENTIAL QUADRANT (BLOCS NORD & SUD + PARC FLEURI) */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* PARKING OUEST */}
                <div className="md:col-span-2 bg-ink/60 border border-paper/15 rounded-xl p-3 flex flex-col justify-between items-center text-center font-mono text-[11px] text-paper/60">
                  <span className="font-bold text-sand uppercase">PARKING OUEST</span>
                  <div className="space-y-1 my-4">
                    <Car className="w-5 h-5 mx-auto text-paper/40" />
                    <span>Stationnement Résidents</span>
                  </div>
                  <span className="text-[10px] text-paper/40">Entrée A</span>
                </div>

                {/* CENTRAL BUILDING BLOCKS AREA */}
                <div className="md:col-span-8 space-y-4">
                  {/* BLOCS NORD 1 & 2 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* BLOC NORD 1 */}
                    <div className="bg-ink border-2 border-laterite/60 rounded-xl p-4 space-y-2 hover:border-laterite transition-all shadow-md">
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="font-bold text-paper">BLOC NORD 1</span>
                        <span className="text-[10px] bg-laterite/20 text-laterite-light px-2 py-0.5 rounded">Coursive Nord</span>
                      </div>
                      <p className="text-[11px] text-paper/70">Studios & Appartements T2</p>
                      {(() => {
                        const matchedUnit = units.find((u) => u.id === 'unit-studio') || units[0];
                        return (
                          <button
                            onClick={() => onSelectUnit(matchedUnit)}
                            className="w-full bg-laterite hover:bg-laterite-light text-paper text-xs font-mono font-bold py-2 rounded transition-all flex items-center justify-center gap-1.5"
                          >
                            Explorer Bloc Nord 1 <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        );
                      })()}
                    </div>

                    {/* BLOC NORD 2 */}
                    <div className="bg-ink border-2 border-laterite/60 rounded-xl p-4 space-y-2 hover:border-laterite transition-all shadow-md">
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="font-bold text-paper">BLOC NORD 2</span>
                        <span className="text-[10px] bg-laterite/20 text-laterite-light px-2 py-0.5 rounded">Coursive Nord</span>
                      </div>
                      <p className="text-[11px] text-paper/70">Appartements T2 Spacieux</p>
                      {(() => {
                        const matchedUnit = units.find((u) => u.id === 'unit-t2') || units[0];
                        return (
                          <button
                            onClick={() => onSelectUnit(matchedUnit)}
                            className="w-full bg-laterite hover:bg-laterite-light text-paper text-xs font-mono font-bold py-2 rounded transition-all flex items-center justify-center gap-1.5"
                          >
                            Explorer Bloc Nord 2 <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        );
                      })()}
                    </div>
                  </div>

                  {/* PARC FLEURI CENTRAL */}
                  <div className="bg-lagoon/15 border-2 border-lagoon/40 rounded-xl p-3 text-center space-y-1">
                    <div className="flex justify-center items-center gap-2 text-xs font-mono font-bold text-lagoon-light">
                      <TreePine className="w-4 h-4" /> PARC FLEURI CENTRAL (Aucun Vis-à-Vis) <TreePine className="w-4 h-4" />
                    </div>
                    <p className="text-[11px] text-paper/70 font-sans">
                      Espace vert paysagé, promenade piétonne privée & piscine lagon centrale.
                    </p>
                  </div>

                  {/* BLOCS SUD 1 & 2 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* BLOC SUD 1 */}
                    <div className="bg-ink border-2 border-laterite/60 rounded-xl p-4 space-y-2 hover:border-laterite transition-all shadow-md">
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="font-bold text-paper">BLOC SUD 1</span>
                        <span className="text-[10px] bg-sand/20 text-sand px-2 py-0.5 rounded">Terrasses Sud</span>
                      </div>
                      <p className="text-[11px] text-paper/70">Appartements T3 Familiaux</p>
                      {(() => {
                        const matchedUnit = units.find((u) => u.id === 'unit-t3') || units[0];
                        return (
                          <button
                            onClick={() => onSelectUnit(matchedUnit)}
                            className="w-full bg-laterite hover:bg-laterite-light text-paper text-xs font-mono font-bold py-2 rounded transition-all flex items-center justify-center gap-1.5"
                          >
                            Explorer Bloc Sud 1 <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        );
                      })()}
                    </div>

                    {/* BLOC SUD 2 */}
                    <div className="bg-ink border-2 border-laterite/60 rounded-xl p-4 space-y-2 hover:border-laterite transition-all shadow-md">
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="font-bold text-paper">BLOC SUD 2</span>
                        <span className="text-[10px] bg-sand/20 text-sand px-2 py-0.5 rounded">Penthouse Attique</span>
                      </div>
                      <p className="text-[11px] text-paper/70">Penthouse T5 Prestige</p>
                      {(() => {
                        const matchedUnit = units.find((u) => u.id === 'unit-t5') || units[0];
                        return (
                          <button
                            onClick={() => onSelectUnit(matchedUnit)}
                            className="w-full bg-laterite hover:bg-laterite-light text-paper text-xs font-mono font-bold py-2 rounded transition-all flex items-center justify-center gap-1.5"
                          >
                            Explorer Bloc Sud 2 <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* PARKING EST */}
                <div className="md:col-span-2 bg-ink/60 border border-paper/15 rounded-xl p-3 flex flex-col justify-between items-center text-center font-mono text-[11px] text-paper/60">
                  <span className="font-bold text-sand uppercase">PARKING EST</span>
                  <div className="space-y-1 my-4">
                    <Car className="w-5 h-5 mx-auto text-paper/40" />
                    <span>Stationnement Résidents</span>
                  </div>
                  <span className="text-[10px] text-paper/40">Entrée B</span>
                </div>
              </div>

              {/* PERIMETER ROAD & ACCÈS GUÉRITES */}
              <div className="bg-ink/80 border border-paper/20 rounded-xl p-3 flex justify-between items-center font-mono text-xs text-paper/70">
                <span className="flex items-center gap-1.5 text-sand">
                  <DoorOpen className="w-4 h-4" /> ENTRÉE A (West Guérite 24h)
                </span>
                <span className="font-bold text-paper text-center hidden sm:inline">
                  CIRCULATION INTÉRIEURE & VOIE PÉRIMPÉTRIQUE SUD
                </span>
                <span className="flex items-center gap-1.5 text-sand">
                  <DoorOpen className="w-4 h-4" /> ENTRÉE B (East Guérite 24h)
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* HD PHOTO DISPLAY WITH FULL VIEW FIT (NO CROPPING) */
        <div className="relative w-full bg-ink-dark overflow-hidden flex flex-col items-center justify-center group p-2">
          {/* Main Image rendered completely without cropping */}
          <div className="relative w-full max-w-5xl flex items-center justify-center">
            <img
              src={activeView.imageUrl}
              alt={activeView.title}
              className="w-full h-auto max-h-[80vh] object-contain rounded-xl shadow-2xl transition-transform duration-700"
            />

            {/* Interactive Hotspots Overlay */}
            {activeView.hotspots && activeView.hotspots.length > 0 && (
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
                          <div className="text-[11px] font-mono text-sand mb-1">
                            {matchedUnit.surfaceTotaleM2} m² · {matchedUnit.startingPriceFormatted}
                          </div>
                          <div className="text-[10px] text-paper/70 line-clamp-2">{matchedUnit.description}</div>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Description overlay bar */}
          <div className="w-full max-w-5xl mt-3 bg-ink/90 backdrop-blur-md border border-paper/20 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
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
      )}

      {/* Complex Quick Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-paper/15 border-t border-paper/15 bg-ink/40 font-mono text-xs text-paper/80">
        <div className="p-3.5 text-center">
          <span className="text-paper/50 block text-[10px] uppercase">Terrain Global</span>
          <span className="font-bold text-paper text-sm">6 593 m²</span>
        </div>
        <div className="p-3.5 text-center">
          <span className="text-paper/50 block text-[10px] uppercase">Livraison Estimée</span>
          <span className="font-bold text-sand text-sm">Trimestre 4 - 2026</span>
        </div>
        <div className="p-3.5 text-center">
          <span className="text-paper/50 block text-[10px] uppercase">Notaire Référant</span>
          <span className="font-bold text-paper text-sm">Étude K. Lawson</span>
        </div>
        <div className="p-3.5 text-center">
          <span className="text-paper/50 block text-[10px] uppercase">Garantie Vente</span>
          <span className="font-bold text-lagoon-light text-sm">Compte Séquestre</span>
        </div>
      </div>
    </div>
  );
}
