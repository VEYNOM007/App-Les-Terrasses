'use client';

import React, { useState } from 'react';
import { Building2, Info, Layers, CheckCircle2, ParkingSquare, ShieldAlert } from 'lucide-react';

interface BlockInfo {
  id: string;
  name: string;
  floors: string;
  typologies: string;
  status: 'EN_COMMERCIALISATION' | 'SEUIL_ATTEINT' | 'EN_CONSTRUCTION';
  progress: number;
  totalUnits: number;
  reservedUnits: number;
  description: string;
  highlight: string;
}

const BLOCKS_DATA: Record<string, BlockInfo> = {
  'bloc-a': {
    id: 'bloc-a',
    name: 'Bloc A (Rangée Sud-Ouest)',
    floors: 'R+3',
    typologies: 'Studio · T2 · T3',
    status: 'EN_COMMERCIALISATION',
    progress: 45,
    totalUnits: 32,
    reservedUnits: 14,
    description: 'Façade sud donnant sur le corridor végétalisé. Rez-de-chaussée sous pilotis pour stationnement privé.',
    highlight: 'Accès piéton direct au nœud central et aux aires de jeux.',
  },
  'bloc-b': {
    id: 'bloc-b',
    name: 'Bloc B (Rangée Sud-Est)',
    floors: 'R+3',
    typologies: 'T2 · T3',
    status: 'EN_COMMERCIALISATION',
    progress: 60,
    totalUnits: 32,
    reservedUnits: 19,
    description: 'Bloc résidentiel calme avec vue imprenable sur les jardins intérieurs.',
    highlight: 'Seuil de pré-vente presque atteint (60% requis pour déblocage des travaux).',
  },
  'bloc-c': {
    id: 'bloc-c',
    name: 'Bloc C (Rangée Nord-Ouest)',
    floors: 'R+3',
    typologies: 'Studio · T2 · T3 · T5 (3ᵉ étage)',
    status: 'SEUIL_ATTEINT',
    progress: 78,
    totalUnits: 34,
    reservedUnits: 26,
    description: 'Bloc nord au calme. Les grands appartements T5 (familles nombreuses) sont situés au 3ᵉ étage.',
    highlight: 'Seuil de vente atteint ! Dossier de financement bancaire en cours de validation.',
  },
  'bloc-d': {
    id: 'bloc-d',
    name: 'Bloc D (Rangée Nord-Est)',
    floors: 'R+3',
    typologies: 'Studio · T2 · T3 · T5 (3ᵉ étage)',
    status: 'EN_COMMERCIALISATION',
    progress: 30,
    totalUnits: 34,
    reservedUnits: 10,
    description: 'Situé côté est proche des infrastructures techniques (château d\'eau & panneaux solaires).',
    highlight: 'Position idéale à l\'écart de l\'agitation commerciale.',
  },
  'commerces': {
    id: 'commerces',
    name: 'Façade Commerciale (Rue Principale)',
    floors: 'R+2',
    typologies: 'Boutiques RDC + Duplex pro',
    status: 'EN_COMMERCIALISATION',
    progress: 80,
    totalUnits: 19,
    reservedUnits: 15,
    description: 'Vitrines sur rue non dénommée. Flux piéton et véhicule garanti sur la façade nord.',
    highlight: 'Emplacement stratégique pour commerces de proximité et bureaux.',
  },
};

export default function MasterPlanInteractive({ onSelectBlock }: { onSelectBlock?: (blockId: string) => void }) {
  const [selectedBlockId, setSelectedBlockId] = useState<string>('bloc-a');
  const activeBlock = BLOCKS_DATA[selectedBlockId] || BLOCKS_DATA['bloc-a'];

  return (
    <section id="masterplan" className="py-20 bg-ink-dark border-b border-paper/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-mono tracking-widest text-sand uppercase mb-2">
              <span className="w-4 h-[1px] bg-laterite-light" />
              Implantation Générale Interactive
            </div>
            <h2 className="font-serif text-2xl sm:text-4xl font-semibold text-paper">
              Plan de masse & Sélection des Blocs
            </h2>
          </div>
          <span className="font-mono text-xs text-paper/50 bg-ink-card px-3 py-1.5 border border-paper/15 rounded">
            ÉCH. approx. 1/1000 — NORD EN HAUT
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Interactive SVG Masterplan */}
          <div className="lg:col-span-8 bg-ink-card border border-paper/30 rounded-md p-6 relative">
            <svg id="masterplan" viewBox="0 0 900 640" className="w-full h-auto block select-none">
              <defs>
                <pattern id="hatchPilotis" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(46,125,107,0.5)" strokeWidth="1" />
                </pattern>
                <pattern id="hatchSolar" width="7" height="7" patternTransform="rotate(-45)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="7" stroke="rgba(216,201,163,0.6)" strokeWidth="1.4" />
                </pattern>
              </defs>

              {/* Contour du terrain */}
              <polygon className="stroke-paper/80 fill-none" strokeWidth="2" points="60,120 130,55 780,55 850,480 130,555 60,480" />

              {/* Façade Commerce */}
              <g
                className="cursor-pointer transition-all hover:opacity-90"
                onClick={() => setSelectedBlockId('commerces')}
              >
                <rect
                  x="130" y="60" width="650" height="55" rx="3"
                  className={selectedBlockId === 'commerces' ? 'fill-sand/40 stroke-sand stroke-2' : 'fill-sand/20 stroke-sand/50'}
                />
                <text className="font-mono text-[11px] fill-paper font-semibold" x="150" y="82">FAÇADE COMMERCIALE (R+2)</text>
                <text className="font-mono text-[9px] fill-paper/70" x="150" y="96">Vitrines RDC · Rue principale nord</text>
              </g>

              {/* Portail d'entrée */}
              <rect x="425" y="53" width="50" height="8" className="fill-paper" />
              <text className="font-mono text-[9px] fill-sand" x="400" y="46">ENTRÉE PRINCIPALE</text>

              {/* Bloc C */}
              <g
                className="cursor-pointer transition-all hover:opacity-90"
                onClick={() => setSelectedBlockId('bloc-c')}
              >
                <rect
                  x="90" y="122" width="330" height="110" rx="3"
                  className={selectedBlockId === 'bloc-c' ? 'fill-slate/50 stroke-sand stroke-2' : 'fill-slate/30 stroke-slate'}
                />
                <rect x="90" y="122" width="330" height="26" fill="url(#hatchPilotis)" stroke="rgba(90,110,140,0.8)" strokeWidth="1" />
                <text className="font-mono text-[12px] fill-paper font-semibold" x="105" y="141">BLOC C · R+3</text>
                <text className="font-mono text-[9px] fill-paper/70" x="105" y="188">RDC pilotis (~15 places) · Studios, T2, T3</text>
                <text className="font-mono text-[9px] fill-sand font-semibold" x="105" y="204">3ᵉ étage : T5 familles nombreuses</text>
              </g>

              {/* Bloc D */}
              <g
                className="cursor-pointer transition-all hover:opacity-90"
                onClick={() => setSelectedBlockId('bloc-d')}
              >
                <rect
                  x="490" y="122" width="330" height="110" rx="3"
                  className={selectedBlockId === 'bloc-d' ? 'fill-slate/50 stroke-sand stroke-2' : 'fill-slate/30 stroke-slate'}
                />
                <rect x="490" y="122" width="330" height="26" fill="url(#hatchPilotis)" stroke="rgba(90,110,140,0.8)" strokeWidth="1" />
                <text className="font-mono text-[12px] fill-paper font-semibold" x="505" y="141">BLOC D · R+3</text>
                <text className="font-mono text-[9px] fill-paper/70" x="505" y="188">RDC pilotis (~15 places) · Studios, T2, T3</text>
                <text className="font-mono text-[9px] fill-sand font-semibold" x="505" y="204">3ᵉ étage : T5 familles nombreuses</text>
              </g>

              {/* Corridor piéton planté */}
              <path
                d="M 90,255 L 380,255 L 400,275 L 400,340 L 480,340 L 500,340 L 520,275 L 820,255 L 820,360 L 540,360 L 520,380 L 520,405 L 480,425 L 420,425 L 400,405 L 400,360 L 90,360 Z"
                className="fill-paper/5 stroke-paper/20 stroke-dasharray-2"
              />
              <text className="font-mono text-[10px] fill-paper/80" x="180" y="300">CORRIDOR PIÉTON PLANTÉ</text>
              <text className="font-mono text-[8px] fill-paper/50" x="180" y="315">Espaces verts filants, ombrage, bancs</text>
              <text className="font-mono text-[10px] fill-lagoon-light font-semibold" x="410" y="300">NŒUD CENTRAL</text>
              <text className="font-mono text-[8px] fill-paper/60" x="590" y="300">Aire de jeux commune</text>

              {/* Bloc A */}
              <g
                className="cursor-pointer transition-all hover:opacity-90"
                onClick={() => setSelectedBlockId('bloc-a')}
              >
                <rect
                  x="90" y="428" width="330" height="110" rx="3"
                  className={selectedBlockId === 'bloc-a' ? 'fill-lagoon/50 stroke-sand stroke-2' : 'fill-lagoon/30 stroke-lagoon-light'}
                />
                <rect x="90" y="512" width="330" height="26" fill="url(#hatchPilotis)" stroke="rgba(79,168,147,0.8)" strokeWidth="1" />
                <text className="font-mono text-[12px] fill-paper font-semibold" x="105" y="452">BLOC A · R+3</text>
                <text className="font-mono text-[9px] fill-paper/70" x="105" y="470">3 étages : Studio · T2 · T3</text>
                <text className="font-mono text-[9px] fill-paper/60" x="105" y="504">RDC pilotis (~15 places parking)</text>
              </g>

              {/* Bloc B */}
              <g
                className="cursor-pointer transition-all hover:opacity-90"
                onClick={() => setSelectedBlockId('bloc-b')}
              >
                <rect
                  x="490" y="428" width="330" height="110" rx="3"
                  className={selectedBlockId === 'bloc-b' ? 'fill-laterite/50 stroke-sand stroke-2' : 'fill-laterite/30 stroke-laterite-light'}
                />
                <rect x="490" y="512" width="330" height="26" fill="url(#hatchPilotis)" stroke="rgba(211,113,77,0.8)" strokeWidth="1" />
                <text className="font-mono text-[12px] fill-paper font-semibold" x="505" y="452">BLOC B · R+3</text>
                <text className="font-mono text-[9px] fill-paper/70" x="505" y="470">3 étages : T2 · T3</text>
                <text className="font-mono text-[9px] fill-paper/60" x="505" y="504">RDC pilotis (~15 places parking)</text>
              </g>

              {/* Auvents Solaires */}
              <rect x="130" y="565" width="280" height="18" rx="2" fill="url(#hatchSolar)" stroke="var(--sand)" strokeWidth="1" />
              <text className="font-mono text-[9px] fill-sand" x="140" y="578">☀ Auvents solaires — visiteurs / commerces</text>

              {/* Boussole */}
              <g transform="translate(838,95)">
                <line x1="0" y1="14" x2="0" y2="-6" stroke="var(--paper)" strokeWidth="1.4" />
                <polygon points="0,-10 -4,-2 4,-2" fill="var(--paper)" />
                <text className="font-mono text-[9px] fill-paper/70" x="-5" y="26">N</text>
              </g>
            </svg>

            <div className="mt-4 flex flex-wrap gap-4 text-xs font-mono text-paper/60 pt-3 border-t border-paper/15">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-lagoon/40 border border-lagoon-light rounded-xs" /> Bloc A (Sud-Ouest)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-laterite/40 border border-laterite-light rounded-xs" /> Bloc B (Sud-Est)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-slate/40 border border-slate rounded-xs" /> Blocs C & D (Nord)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-sand/40 border border-sand rounded-xs" /> Façade Commerciale</span>
            </div>
          </div>

          {/* Selected Block Info Box */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-ink-card border border-paper/30 rounded-md p-6 space-y-4">
              <div className="flex justify-between items-start">
                <span className="font-mono text-xs text-sand uppercase tracking-wider">Détails du Lot sélectionné</span>
                <span className={`text-[11px] font-mono px-2.5 py-1 rounded border ${
                  activeBlock.status === 'SEUIL_ATTEINT'
                    ? 'bg-lagoon/20 text-lagoon-light border-lagoon/50'
                    : 'bg-laterite/20 text-laterite-light border-laterite/50'
                }`}>
                  {activeBlock.status === 'SEUIL_ATTEINT' ? 'Seuil Rejoint !' : 'Ventes En Cours'}
                </span>
              </div>

              <h3 className="font-serif text-xl font-semibold text-paper">{activeBlock.name}</h3>

              <p className="text-sm text-paper/80 leading-relaxed">
                {activeBlock.description}
              </p>

              <div className="p-3 bg-paper/5 border-l-2 border-sand rounded-r text-xs font-mono text-sand">
                💡 {activeBlock.highlight}
              </div>

              {/* Progress bar toward 60% threshold */}
              <div className="space-y-2 pt-2 border-t border-paper/15 font-mono text-xs">
                <div className="flex justify-between text-paper/70">
                  <span>Pré-ventes actées ({activeBlock.reservedUnits}/{activeBlock.totalUnits} logements)</span>
                  <span className="font-bold text-paper">{activeBlock.progress}%</span>
                </div>
                <div className="w-full bg-paper/10 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-laterite to-lagoon h-full transition-all duration-500"
                    style={{ width: `${activeBlock.progress}%` }}
                  />
                </div>
                <p className="text-[11px] text-paper/50">
                  Seuil requis : 60% pour déclenchement du financement bancaire et démarrage du chantier.
                </p>
              </div>

              <button
                onClick={() => onSelectBlock && onSelectBlock(activeBlock.id)}
                className="w-full bg-laterite hover:bg-laterite-light text-paper font-mono text-xs py-3 rounded transition-colors flex items-center justify-center gap-2"
              >
                <Building2 className="w-4 h-4" /> Réserver dans ce bloc →
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
