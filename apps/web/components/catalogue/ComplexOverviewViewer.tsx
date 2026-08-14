'use client';

import React, { useState } from 'react';
import { ComplexView, Unit3DDetails } from '../../lib/catalogData';
import { resolveHotspotTarget } from '../../lib/catalog/viewer-hotspots';
import {
  Eye,
  Sparkles,
  Building,
  ChevronRight,
  ShieldCheck,
  Compass,
  TreePine,
  Car,
  DoorOpen
} from 'lucide-react';

interface ComplexOverviewViewerProps {
  views: ComplexView[];
  units: Unit3DDetails[];
  onSelectUnit: (unit: Unit3DDetails) => void;
}

// ─────────────────────────────────────────────────────────────
// SVG PLAN DE MASSE ARCHITECTURAL (vue du dessus, style bureau d'études)
// ─────────────────────────────────────────────────────────────
function MasterPlanSVG({ units, onSelectUnit }: { units: Unit3DDetails[]; onSelectUnit: (u: Unit3DDetails) => void }) {
  const [hoveredBlock, setHoveredBlock] = useState<string | null>(null);

  const getUnit = (id: string) => resolveHotspotTarget(id, units);

  return (
    <div className="relative w-full bg-[#0B1220] p-4 sm:p-8 flex flex-col items-center">
      {/* Blueprint dot grid background */}
      <div
        className="absolute inset-0 opacity-25 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#4FA893 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Header info */}
      <div className="relative z-10 w-full max-w-4xl flex justify-between items-center mb-5 font-mono text-xs">
        <div className="flex items-center gap-2 text-lagoon-light">
          <Compass className="w-4 h-4 animate-pulse" />
          <span className="font-bold uppercase tracking-widest">Plan de Masse · Échelle 1/500</span>
        </div>
        <div className="flex items-center gap-4 text-paper/60">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-laterite/70 inline-block border border-laterite-light" /> Bâtiments résidentiels
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-sand/30 inline-block border border-sand/60" /> Boutiques
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-lagoon/40 inline-block border border-lagoon-light" /> Espaces verts
          </span>
        </div>
      </div>

      {/* SVG Plan */}
      <div className="relative z-10 w-full max-w-4xl border-2 border-sand/30 rounded-xl overflow-hidden shadow-2xl bg-[#0E1A2D]">
        <svg
          viewBox="0 0 900 640"
          className="w-full h-auto block"
          style={{ fontFamily: '"IBM Plex Mono", monospace' }}
        >
          {/* ── Background terrain ── */}
          <rect x="0" y="0" width="900" height="640" fill="#0E1A2D" />

          {/* ── Grid lines ── */}
          {[100, 200, 300, 400, 500, 600, 700, 800].map((x) => (
            <line key={`vg-${x}`} x1={x} y1="0" x2={x} y2="640" stroke="#1E3A5F" strokeWidth="0.5" strokeDasharray="4,6" />
          ))}
          {[80, 160, 240, 320, 400, 480, 560].map((y) => (
            <line key={`hg-${y}`} x1="0" y1={y} x2="900" y2={y} stroke="#1E3A5F" strokeWidth="0.5" strokeDasharray="4,6" />
          ))}

          {/* ── Perimeter wall ── */}
          <rect x="60" y="60" width="780" height="520" fill="none" stroke="#5A6E8C" strokeWidth="2" strokeDasharray="8,4" rx="4" />

          {/* ── RUE PÉRIPHÉRIQUE NORD (top) ── */}
          <rect x="0" y="0" width="900" height="58" fill="#152238" />
          <line x1="0" y1="58" x2="900" y2="58" stroke="#D8C9A3" strokeWidth="1.5" />
          <text x="450" y="32" textAnchor="middle" fill="#D8C9A3" fontSize="11" fontWeight="bold" letterSpacing="2">
            RUE PÉRIPHÉRIQUE / NORD
          </text>
          <text x="450" y="48" textAnchor="middle" fill="#5A6E8C" fontSize="9">
            Voie publique principale
          </text>

          {/* ── RUE PÉRIPHÉRIQUE SUD (bottom) ── */}
          <rect x="0" y="582" width="900" height="58" fill="#152238" />
          <line x1="0" y1="582" x2="900" y2="582" stroke="#D8C9A3" strokeWidth="1.5" />
          <text x="450" y="608" textAnchor="middle" fill="#D8C9A3" fontSize="11" fontWeight="bold" letterSpacing="2">
            PERIMETER ROAD (Route Sud)
          </text>

          {/* ── PARKING OUEST ── */}
          <rect x="62" y="62" width="90" height="518" fill="#0F1B2D" stroke="#2A4060" strokeWidth="1" rx="2" />
          <text x="107" y="300" textAnchor="middle" fill="#5A6E8C" fontSize="9" fontWeight="bold"
            transform="rotate(-90, 107, 300)" letterSpacing="1">PARKING OUEST</text>
          {/* Parking slots lines */}
          {[100, 130, 160, 190, 220, 250, 280, 310, 340, 370, 400, 430, 460, 490, 520].map((y) => (
            <line key={`pw-${y}`} x1="68" y1={y} x2="148" y2={y} stroke="#1E3A5F" strokeWidth="0.8" />
          ))}
          <line x1="108" y1="70" x2="108" y2="570" stroke="#2A4060" strokeWidth="0.8" />

          {/* ── PARKING EST ── */}
          <rect x="748" y="62" width="90" height="518" fill="#0F1B2D" stroke="#2A4060" strokeWidth="1" rx="2" />
          <text x="793" y="300" textAnchor="middle" fill="#5A6E8C" fontSize="9" fontWeight="bold"
            transform="rotate(90, 793, 300)" letterSpacing="1">PARKING EST</text>
          {[100, 130, 160, 190, 220, 250, 280, 310, 340, 370, 400, 430, 460, 490, 520].map((y) => (
            <line key={`pe-${y}`} x1="754" y1={y} x2="834" y2={y} stroke="#1E3A5F" strokeWidth="0.8" />
          ))}
          <line x1="793" y1="70" x2="793" y2="570" stroke="#2A4060" strokeWidth="0.8" />

          {/* ── BOUTIQUES (Façade Nord) ── */}
          <rect x="156" y="64" width="588" height="72" fill="#2A1F0A" stroke="#D8C9A3" strokeWidth="1.5" rx="3" />
          <text x="450" y="86" textAnchor="middle" fill="#D8C9A3" fontSize="10" fontWeight="bold" letterSpacing="1">
            FAÇADE BOUTIQUES — 10 locaux commerciaux
          </text>
          <text x="450" y="100" textAnchor="middle" fill="#D8C9A3" fontSize="8.5">
            UARDE PARKING • BOUTIQUE • BOUTIQUE • BOUTIQUE • BOUTIQUE • BOUTIQUE • BOUTIQUE • BOUTIQUE • BOUTIQUE • UARDE PARKING
          </text>
          {/* Boutique dividers */}
          {[214, 272, 330, 388, 446, 504, 562, 620, 678].map((x) => (
            <line key={`bd-${x}`} x1={x} y1="64" x2={x} y2="136" stroke="#D8C9A3" strokeWidth="0.6" strokeDasharray="2,2" />
          ))}
          {/* PARKING CLIENTS banner */}
          <rect x="156" y="136" width="588" height="30" fill="#101E30" stroke="#2A4060" strokeWidth="0.8" />
          <text x="450" y="155" textAnchor="middle" fill="#5A6E8C" fontSize="9" letterSpacing="1">
            PARKING CLIENTS (6 m de large) + Zone de livraison
          </text>
          {/* Entrée Résidence labels */}
          <text x="180" y="152" textAnchor="middle" fill="#4FA893" fontSize="7.5" fontWeight="bold">ENTRÉE RÉSIDENCE</text>
          <text x="720" y="152" textAnchor="middle" fill="#4FA893" fontSize="7.5" fontWeight="bold">ENTRÉE RÉSIDENCE B</text>

          {/* ── BLOC NORD 1 (clickable) ── */}
          <g
            onClick={() => {
              const unit = getUnit('unit-studio');
              if (unit) onSelectUnit(unit);
            }}
            onMouseEnter={() => setHoveredBlock('bloc-nord-1')}
            onMouseLeave={() => setHoveredBlock(null)}
            className="cursor-pointer"
            style={{ transition: 'all 0.2s' }}
          >
            <rect
              x="164" y="170" width="250" height="140"
              fill={hoveredBlock === 'bloc-nord-1' ? '#6B2E1C' : '#3D1A0E'}
              stroke={hoveredBlock === 'bloc-nord-1' ? '#D3714D' : '#B5502E'}
              strokeWidth={hoveredBlock === 'bloc-nord-1' ? 2.5 : 1.5}
              rx="4"
            />
            {/* Floor lines */}
            {[216, 262].map((y) => (
              <line key={`bn1-${y}`} x1="164" y1={y} x2="414" y2={y} stroke="#B5502E" strokeWidth="0.6" strokeDasharray="5,3" />
            ))}
            {/* Window marks */}
            {[185, 220, 255, 285, 320, 355, 385].map((x) => (
              <rect key={`win-bn1-${x}`} x={x} y="175" width="16" height="8" fill="#4FA893" opacity="0.6" rx="1" />
            ))}
            <text x="289" y="226" textAnchor="middle" fill="#F4EFE4" fontSize="12" fontWeight="bold">BLOC NORD 1</text>
            <text x="289" y="243" textAnchor="middle" fill="#D3714D" fontSize="9">Studios · Appartements T2</text>
            <text x="289" y="257" textAnchor="middle" fill="#D8C9A3" fontSize="8">R+3 · Coursive Nord</text>
            {/* Click hint */}
            {hoveredBlock === 'bloc-nord-1' && (
              <text x="289" y="296" textAnchor="middle" fill="#D3714D" fontSize="9" fontWeight="bold">
                ▶ Voir les appartements
              </text>
            )}
          </g>

          {/* ── BLOC NORD 2 (clickable) ── */}
          <g
            onClick={() => {
              const unit = getUnit('unit-t2');
              if (unit) onSelectUnit(unit);
            }}
            onMouseEnter={() => setHoveredBlock('bloc-nord-2')}
            onMouseLeave={() => setHoveredBlock(null)}
            className="cursor-pointer"
          >
            <rect
              x="486" y="170" width="250" height="140"
              fill={hoveredBlock === 'bloc-nord-2' ? '#6B2E1C' : '#3D1A0E'}
              stroke={hoveredBlock === 'bloc-nord-2' ? '#D3714D' : '#B5502E'}
              strokeWidth={hoveredBlock === 'bloc-nord-2' ? 2.5 : 1.5}
              rx="4"
            />
            {[216, 262].map((y) => (
              <line key={`bn2-${y}`} x1="486" y1={y} x2="736" y2={y} stroke="#B5502E" strokeWidth="0.6" strokeDasharray="5,3" />
            ))}
            {[505, 540, 575, 605, 640, 675, 707].map((x) => (
              <rect key={`win-bn2-${x}`} x={x} y="175" width="16" height="8" fill="#4FA893" opacity="0.6" rx="1" />
            ))}
            <text x="611" y="226" textAnchor="middle" fill="#F4EFE4" fontSize="12" fontWeight="bold">BLOC NORD 2</text>
            <text x="611" y="243" textAnchor="middle" fill="#D3714D" fontSize="9">Appartements T2 Spacieux</text>
            <text x="611" y="257" textAnchor="middle" fill="#D8C9A3" fontSize="8">R+3 · Coursive Nord</text>
            {hoveredBlock === 'bloc-nord-2' && (
              <text x="611" y="296" textAnchor="middle" fill="#D3714D" fontSize="9" fontWeight="bold">
                ▶ Voir les appartements
              </text>
            )}
          </g>

          {/* ── Coursive Nord label ── */}
          <rect x="164" y="312" width="572" height="18" fill="#0B1525" stroke="#2A4060" strokeWidth="0.5" />
          <text x="450" y="325" textAnchor="middle" fill="#4FA893" fontSize="8" letterSpacing="2">
            COURSIVE NORD
          </text>

          {/* ── PARC FLEURI CENTRAL ── */}
          <rect x="164" y="330" width="572" height="90" fill="#0A1F18" stroke="#2E7D6B" strokeWidth="1.5" rx="3" />
          {/* Tree symbols */}
          {[200, 240, 290, 340, 395, 450, 505, 555, 605, 655, 700].map((x) => (
            <g key={`tree-${x}`}>
              <circle cx={x} cy="375" r="14" fill="#1a3d2b" stroke="#2E7D6B" strokeWidth="0.8" />
              <circle cx={x} cy="375" r="7" fill="#2E7D6B" opacity="0.7" />
            </g>
          ))}
          <text x="450" y="358" textAnchor="middle" fill="#4FA893" fontSize="11" fontWeight="bold">PARC FLEURI CENTRAL</text>
          <text x="450" y="402" textAnchor="middle" fill="#4FA893" fontSize="8.5">Aucun vis-à-vis · Piscine lagon · Aires de jeux</text>

          {/* ── Coursive Sud label ── */}
          <rect x="164" y="420" width="572" height="18" fill="#0B1525" stroke="#2A4060" strokeWidth="0.5" />
          <text x="450" y="433" textAnchor="middle" fill="#D8C9A3" fontSize="8" letterSpacing="2">
            TERRASSES SUD
          </text>

          {/* ── BLOC SUD 1 (clickable) ── */}
          <g
            onClick={() => {
              const unit = getUnit('unit-t3');
              if (unit) onSelectUnit(unit);
            }}
            onMouseEnter={() => setHoveredBlock('bloc-sud-1')}
            onMouseLeave={() => setHoveredBlock(null)}
            className="cursor-pointer"
          >
            <rect
              x="164" y="440" width="250" height="140"
              fill={hoveredBlock === 'bloc-sud-1' ? '#1A3F34' : '#0F2A22'}
              stroke={hoveredBlock === 'bloc-sud-1' ? '#4FA893' : '#2E7D6B'}
              strokeWidth={hoveredBlock === 'bloc-sud-1' ? 2.5 : 1.5}
              rx="4"
            />
            {[487, 534].map((y) => (
              <line key={`bs1-${y}`} x1="164" y1={y} x2="414" y2={y} stroke="#2E7D6B" strokeWidth="0.6" strokeDasharray="5,3" />
            ))}
            {[185, 220, 255, 285, 320, 355, 385].map((x) => (
              <rect key={`win-bs1-${x}`} x={x} y="568" width="16" height="8" fill="#4FA893" opacity="0.6" rx="1" />
            ))}
            <text x="289" y="494" textAnchor="middle" fill="#F4EFE4" fontSize="12" fontWeight="bold">BLOC SUD 1</text>
            <text x="289" y="511" textAnchor="middle" fill="#4FA893" fontSize="9">Appartements T3 Familiaux</text>
            <text x="289" y="525" textAnchor="middle" fill="#D8C9A3" fontSize="8">R+3 · Terrasses Sud</text>
            {hoveredBlock === 'bloc-sud-1' && (
              <text x="289" y="562" textAnchor="middle" fill="#4FA893" fontSize="9" fontWeight="bold">
                ▶ Voir les appartements
              </text>
            )}
          </g>

          {/* ── BLOC SUD 2 (clickable) ── */}
          <g
            onClick={() => {
              const unit = getUnit('unit-t5');
              if (unit) onSelectUnit(unit);
            }}
            onMouseEnter={() => setHoveredBlock('bloc-sud-2')}
            onMouseLeave={() => setHoveredBlock(null)}
            className="cursor-pointer"
          >
            <rect
              x="486" y="440" width="250" height="140"
              fill={hoveredBlock === 'bloc-sud-2' ? '#1A3F34' : '#0F2A22'}
              stroke={hoveredBlock === 'bloc-sud-2' ? '#4FA893' : '#2E7D6B'}
              strokeWidth={hoveredBlock === 'bloc-sud-2' ? 2.5 : 1.5}
              rx="4"
            />
            {[487, 534].map((y) => (
              <line key={`bs2-${y}`} x1="486" y1={y} x2="736" y2={y} stroke="#2E7D6B" strokeWidth="0.6" strokeDasharray="5,3" />
            ))}
            {[505, 540, 575, 605, 640, 675, 707].map((x) => (
              <rect key={`win-bs2-${x}`} x={x} y="568" width="16" height="8" fill="#4FA893" opacity="0.6" rx="1" />
            ))}
            <text x="611" y="494" textAnchor="middle" fill="#F4EFE4" fontSize="12" fontWeight="bold">BLOC SUD 2</text>
            <text x="611" y="511" textAnchor="middle" fill="#4FA893" fontSize="9">Penthouse T5 Prestige · Attique</text>
            <text x="611" y="525" textAnchor="middle" fill="#D8C9A3" fontSize="8">R+3+1 · Vue panoramique</text>
            {hoveredBlock === 'bloc-sud-2' && (
              <text x="611" y="562" textAnchor="middle" fill="#4FA893" fontSize="9" fontWeight="bold">
                ▶ Voir les appartements
              </text>
            )}
          </g>

          {/* ── FAÇADE BOUTIQUES (clickable) ── */}
          <g
            onClick={() => {
              const unit = getUnit('unit-commerce');
              if (unit) onSelectUnit(unit);
            }}
            onMouseEnter={() => setHoveredBlock('boutiques')}
            onMouseLeave={() => setHoveredBlock(null)}
            className="cursor-pointer"
          >
            <rect
              x="156" y="64" width="588" height="72"
              fill={hoveredBlock === 'boutiques' ? '#3B2D0A' : '#2A1F0A'}
              stroke={hoveredBlock === 'boutiques' ? '#F0C040' : '#D8C9A3'}
              strokeWidth={hoveredBlock === 'boutiques' ? 2.5 : 1.5}
              rx="3"
              style={{ cursor: 'pointer' }}
            />
            {hoveredBlock === 'boutiques' && (
              <text x="450" y="122" textAnchor="middle" fill="#D8C9A3" fontSize="9" fontWeight="bold">
                ▶ Voir les locaux commerciaux
              </text>
            )}
          </g>

          {/* ── North Arrow ── */}
          <g transform="translate(855, 120)">
            <circle cx="0" cy="0" r="18" fill="#0E1A2D" stroke="#4FA893" strokeWidth="1" />
            <polygon points="0,-13 -5,6 0,2 5,6" fill="#4FA893" />
            <text x="0" y="8" textAnchor="middle" fill="#4FA893" fontSize="8" fontWeight="bold">N</text>
          </g>

          {/* ── Dimension lines ── */}
          {/* Horizontal total */}
          <line x1="60" y1="635" x2="840" y2="635" stroke="#5A6E8C" strokeWidth="0.8" />
          <line x1="60" y1="630" x2="60" y2="640" stroke="#5A6E8C" strokeWidth="0.8" />
          <line x1="840" y1="630" x2="840" y2="640" stroke="#5A6E8C" strokeWidth="0.8" />
          <text x="450" y="628" textAnchor="middle" fill="#5A6E8C" fontSize="8">← 6 593 m² · Titre Foncier RM 100/71 →</text>

          {/* ── Entrée A & B ── */}
          <rect x="152" y="582" width="60" height="30" fill="#0B1820" stroke="#4FA893" strokeWidth="1" />
          <text x="182" y="598" textAnchor="middle" fill="#4FA893" fontSize="7.5" fontWeight="bold">ENTRÉE A</text>
          <text x="182" y="608" textAnchor="middle" fill="#5A6E8C" fontSize="7">(West Guérite)</text>
          <rect x="688" y="582" width="60" height="30" fill="#0B1820" stroke="#4FA893" strokeWidth="1" />
          <text x="718" y="598" textAnchor="middle" fill="#4FA893" fontSize="7.5" fontWeight="bold">ENTRÉE B</text>
          <text x="718" y="608" textAnchor="middle" fill="#5A6E8C" fontSize="7">(East Guérite)</text>

          {/* ── Circulation intérieure ── */}
          <rect x="156" y="582" width="532" height="0" fill="none" />
          <text x="450" y="596" textAnchor="middle" fill="#2A4060" fontSize="8.5" letterSpacing="1">
            CIRCULATION INTÉRIEURE ET PARC AGRANDI
          </text>

          {/* ── Hotspot badges on blocs ── */}
          {/* Bloc Nord 1 solar panels top */}
          <rect x="195" y="170" width="180" height="12" fill="#1a3d2b" stroke="#2E7D6B" strokeWidth="0.5" rx="1" opacity="0.8" />
          <text x="285" y="180" textAnchor="middle" fill="#4FA893" fontSize="7">▦ Panneaux Solaires</text>
          {/* Bloc Nord 2 solar panels top */}
          <rect x="518" y="170" width="180" height="12" fill="#1a3d2b" stroke="#2E7D6B" strokeWidth="0.5" rx="1" opacity="0.8" />
          <text x="608" y="180" textAnchor="middle" fill="#4FA893" fontSize="7">▦ Panneaux Solaires</text>
        </svg>
      </div>

      {/* Legend / click instruction */}
      <div className="relative z-10 w-full max-w-4xl mt-4 bg-ink/80 border border-paper/15 rounded-xl p-3 flex flex-wrap justify-between items-center gap-3 font-mono text-xs text-paper/70">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-laterite-light animate-ping inline-block" />
          Cliquez sur un bloc ou les boutiques pour explorer les appartements
        </span>
        <span className="inline-flex items-center gap-1 bg-lagoon/20 text-lagoon-light border border-lagoon/40 px-2.5 py-1 rounded">
          <ShieldCheck className="w-3.5 h-3.5" /> Titre Foncier RM 100/71 · 3 Façades
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AERIAL PHOTO VIEW (image en entier, object-contain)
// ─────────────────────────────────────────────────────────────
function AerialPhotoView({
  view,
  units,
  onSelectUnit,
}: {
  view: ComplexView;
  units: Unit3DDetails[];
  onSelectUnit: (u: Unit3DDetails) => void;
}) {
  return (
    <div className="relative w-full bg-ink-dark flex flex-col items-center p-3 sm:p-6">
      <div className="relative w-full max-w-5xl">
        <img
          src={view.imageUrl}
          alt={view.title}
          className="w-full h-auto object-contain rounded-xl shadow-2xl"
          style={{ maxHeight: '75vh' }}
        />

        {/* Hotspot overlay */}
        {view.hotspots && view.hotspots.length > 0 && (
          <div className="absolute inset-0">
            {view.hotspots.map((hs) => {
              const matchedUnit = resolveHotspotTarget(hs.targetBlockId, units);
              if (!matchedUnit) return null;
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
                    <span className="font-semibold hidden sm:inline">{hs.label}</span>
                    <ChevronRight className="w-3 h-3 text-sand group-hover/hs:translate-x-0.5 transition-transform" />

                    {/* Tooltip */}
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
      </div>

      <div className="w-full max-w-5xl mt-3 bg-ink/90 border border-paper/20 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h4 className="font-serif text-sm font-semibold text-paper">{view.subtitle}</h4>
          <p className="text-xs text-paper/70">{view.description}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-mono bg-lagoon/20 text-lagoon-light border border-lagoon/40 px-2.5 py-1 rounded shrink-0">
          <ShieldCheck className="w-3.5 h-3.5" /> Titre Foncier RM 100/71
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN VIEWER COMPONENT
// ─────────────────────────────────────────────────────────────
export default function ComplexOverviewViewer({ views, units, onSelectUnit }: ComplexOverviewViewerProps) {
  const [activeViewId, setActiveViewId] = useState<string>('view-masterplan');
  const activeView = views.find((v) => v.id === activeViewId) || views[0];

  return (
    <div className="bg-ink-card border border-paper/20 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header & Tab switcher */}
      <div className="bg-ink/95 border-b border-paper/15 p-4 sm:p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-mono text-sand uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4 text-laterite-light" />
            Vue d'ensemble · Titre Foncier RM 100/71 · 6 593 m²
          </div>
          <h2 className="font-serif text-xl sm:text-2xl font-semibold text-paper">
            {activeView.title}
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {views.map((v) => (
            <button
              key={v.id}
              onClick={() => setActiveViewId(v.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-mono transition-all flex items-center gap-2 ${
                activeViewId === v.id
                  ? 'bg-laterite text-paper shadow-lg font-bold border border-laterite-light'
                  : 'bg-ink/70 text-paper/70 hover:bg-paper/10 hover:text-paper border border-paper/15'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              {v.title}
            </button>
          ))}
        </div>
      </div>

      {/* Render correct view */}
      {activeView.id === 'view-masterplan'
        ? <MasterPlanSVG units={units} onSelectUnit={onSelectUnit} />
        : <AerialPhotoView view={activeView} units={units} onSelectUnit={onSelectUnit} />
      }

      {/* Metrics bar */}
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
