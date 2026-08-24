'use client';

import React, { useState } from 'react';
import { ComplexInfo, ComplexView, Unit3DDetails } from '../../lib/catalogData';
import { resolveHotspotTarget } from '../../lib/catalog/viewer-hotspots';
import { selectActiveView } from '../../lib/catalog/overview-view';
import {
  Eye,
  Sparkles,
  Building,
  ChevronRight,
  ShieldCheck,
  LayoutGrid,
} from 'lucide-react';

interface ComplexOverviewViewerProps {
  views: ComplexView[];
  units: Unit3DDetails[];
  blockTargets: { id: string; unitId: string }[];
  blockViewsMap: Record<string, ComplexView[]>;
  residenceInfo: Pick<ComplexInfo, 'titleDeed' | 'totalLandArea' | 'deliveryDate' | 'notaryName' | 'escrowBank'>;
  onSelectUnit: (unitId: string) => void;
}

// ─────────────────────────────────────────────────────────────
// AERIAL PHOTO VIEW (image en entier, object-contain)
// ─────────────────────────────────────────────────────────────
function AerialPhotoView({
  view,
  blockTargets,
  titleDeed,
  onSelectUnit,
  onSelectBlock,
  activeBlockIds,
}: {
  view: ComplexView;
  blockTargets: { id: string; unitId: string }[];
  titleDeed: string;
  onSelectUnit: (unitId: string) => void;
  onSelectBlock: (blockId: string) => void;
  activeBlockIds: string[];
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
              if (hs.targetType === 'BLOCK') {
                if (!activeBlockIds.includes(hs.targetId)) return null;
                return (
                  <div
                    key={hs.id}
                    style={{ top: hs.top, left: hs.left }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
                  >
                    <button
                      onClick={() => onSelectBlock(hs.targetId)}
                      className="relative group/hs flex items-center gap-2 bg-ink/90 hover:bg-lagoon text-paper border-2 border-lagoon hover:border-paper px-3 py-1.5 rounded-full text-xs font-mono shadow-2xl transition-all hover:scale-110"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-lagoon-light animate-ping absolute -left-1 -top-1" />
                      <LayoutGrid className="w-3.5 h-3.5 text-lagoon group-hover/hs:text-paper" />
                      <span className="font-semibold hidden sm:inline">{hs.label}</span>
                      <ChevronRight className="w-3 h-3 text-lagoon group-hover/hs:translate-x-0.5 transition-transform" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover/hs:flex flex-col bg-ink border border-paper/30 p-3 rounded-lg w-56 text-left shadow-2xl pointer-events-none z-30">
                        <div className="font-serif text-sm font-semibold text-paper mb-1">{hs.label}</div>
                      </div>
                    </button>
                  </div>
                );
              }

              const matchedTarget = resolveHotspotTarget(hs.targetId, blockTargets);
              if (!matchedTarget) return null;
              return (
                <div
                  key={hs.id}
                  style={{ top: hs.top, left: hs.left }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
                >
                  <button
                    onClick={() => onSelectUnit(matchedTarget.unitId)}
                    className="relative group/hs flex items-center gap-2 bg-ink/90 hover:bg-laterite text-paper border-2 border-sand hover:border-paper px-3 py-1.5 rounded-full text-xs font-mono shadow-2xl transition-all hover:scale-110"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-laterite-light animate-ping absolute -left-1 -top-1" />
                    <Building className="w-3.5 h-3.5 text-sand group-hover/hs:text-paper" />
                    <span className="font-semibold hidden sm:inline">{hs.label}</span>
                    <ChevronRight className="w-3 h-3 text-sand group-hover/hs:translate-x-0.5 transition-transform" />

                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover/hs:flex flex-col bg-ink border border-paper/30 p-3 rounded-lg w-56 text-left shadow-2xl pointer-events-none z-30">
                      <div className="font-serif text-sm font-semibold text-paper mb-1">{hs.label}</div>
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
           <ShieldCheck className="w-3.5 h-3.5" /> {titleDeed}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN VIEWER COMPONENT
// ─────────────────────────────────────────────────────────────
export default function ComplexOverviewViewer({ views, units, blockTargets, blockViewsMap, residenceInfo, onSelectUnit }: ComplexOverviewViewerProps) {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [activeViewId, setActiveViewId] = useState<string>('view-masterplan');

  const blockEntries = Object.entries(blockViewsMap);
  const hasBlockTabs = blockEntries.length > 0;

  const currentViews = activeTab === 'overview' ? views : (blockViewsMap[activeTab] ?? []);
  const activeView = selectActiveView(currentViews, activeViewId);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    const viewsForTab = tabId === 'overview' ? views : (blockViewsMap[tabId] ?? []);
    setActiveViewId(viewsForTab[0]?.id ?? '');
  };

  const handleSelectBlock = (blockId: string) => {
    if (blockViewsMap[blockId]) {
      handleTabChange(blockId);
    }
  };

  const blockLabels: Record<string, string> = {};
  for (const [id, blockViews] of blockEntries) {
    blockLabels[id] = blockViews[0]?.title?.split(' ')[0] ?? id;
  }

  if (!activeView) {
    return (
      <div className="bg-ink-card border border-paper/20 rounded-2xl overflow-hidden shadow-2xl p-8 text-center">
        <p className="text-paper/50 font-mono text-sm">Aucune vue disponible pour cette résidence.</p>
      </div>
    );
  }

  return (
    <div className="bg-ink-card border border-paper/20 rounded-2xl overflow-hidden shadow-2xl">
      {/* Block tabs (if any block has views) */}
      {hasBlockTabs && (
        <div className="bg-ink/95 border-b border-paper/15 px-4 sm:px-5 pt-3 pb-0 flex flex-wrap gap-1.5">
          <button
            onClick={() => handleTabChange('overview')}
            className={`px-3 py-1.5 rounded-t-lg text-[11px] font-mono transition-all ${
              activeTab === 'overview'
                ? 'bg-ink-card text-paper border border-paper/15 border-b-ink-card font-bold'
                : 'text-paper/50 hover:text-paper hover:bg-paper/5'
            }`}
          >
            <LayoutGrid className="w-3 h-3 inline mr-1.5 -mt-0.5" />
            Vue d'ensemble
          </button>
          {blockEntries.map(([id]) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`px-3 py-1.5 rounded-t-lg text-[11px] font-mono transition-all ${
                activeTab === id
                  ? 'bg-ink-card text-paper border border-paper/15 border-b-ink-card font-bold'
                  : 'text-paper/50 hover:text-paper hover:bg-paper/5'
              }`}
            >
              <Building className="w-3 h-3 inline mr-1.5 -mt-0.5" />
              {blockLabels[id]}
            </button>
          ))}
        </div>
      )}

      {/* Header & View switcher */}
      <div className="bg-ink/95 border-b border-paper/15 p-4 sm:p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-mono text-sand uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4 text-laterite-light" />
            {activeTab === 'overview' ? (
              <>Vue d'ensemble · {residenceInfo.titleDeed} · {residenceInfo.totalLandArea}</>
            ) : (
              <>{blockLabels[activeTab]} · {residenceInfo.titleDeed}</>
            )}
          </div>
          <h2 className="font-serif text-xl sm:text-2xl font-semibold text-paper">
            {activeView.title}
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {currentViews.map((v) => (
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
      <AerialPhotoView
        view={activeView}
        blockTargets={blockTargets}
        titleDeed={residenceInfo.titleDeed}
        onSelectUnit={onSelectUnit}
        onSelectBlock={handleSelectBlock}
        activeBlockIds={blockTargets.map((t) => t.id)}
      />

      {/* Metrics bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-paper/15 border-t border-paper/15 bg-ink/40 font-mono text-xs text-paper/80">
        <div className="p-3.5 text-center">
          <span className="text-paper/50 block text-[10px] uppercase">Terrain Global</span>
          <span className="font-bold text-paper text-sm">{residenceInfo.totalLandArea}</span>
        </div>
        {residenceInfo.deliveryDate && (
          <div className="p-3.5 text-center">
            <span className="text-paper/50 block text-[10px] uppercase">Livraison Estimée</span>
            <span className="font-bold text-sand text-sm">{residenceInfo.deliveryDate}</span>
          </div>
        )}
        {residenceInfo.notaryName && (
          <div className="p-3.5 text-center">
            <span className="text-paper/50 block text-[10px] uppercase">Notaire Référant</span>
            <span className="font-bold text-paper text-sm">{residenceInfo.notaryName}</span>
          </div>
        )}
        {residenceInfo.escrowBank && (
          <div className="p-3.5 text-center">
            <span className="text-paper/50 block text-[10px] uppercase">Garantie Vente</span>
            <span className="font-bold text-lagoon-light text-sm">{residenceInfo.escrowBank}</span>
          </div>
        )}
      </div>
    </div>
  );
}
