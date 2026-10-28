'use client';

import React, { useState } from 'react';
import { ComplexInfo, ComplexView } from '../../lib/catalogData';
import { resolveHotspotTarget } from '../../lib/catalog/viewer-hotspots';
import { selectActiveView } from '../../lib/catalog/overview-view';
import {
  Building,
  ChevronRight,
  Eye,
  LayoutGrid,
  Maximize,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import ImageLightbox from '../ImageLightbox';

export interface BlockTarget {
  id: string;
  unitId: string;
  name: string;
}

interface ComplexOverviewViewerProps {
  views: ComplexView[];
  units: { id: string }[];
  blockTargets: BlockTarget[];
  blockViewsMap: Record<string, ComplexView[]>;
  residenceInfo: Pick<
    ComplexInfo,
    'titleDeed' | 'totalLandArea' | 'deliveryDate' | 'notaryName' | 'escrowBank'
  >;
  onSelectUnit: (unitId: string) => void;
}

// ─────────────────────────────────────────────────────────────
// VUE AÉRIENNE (image entière + hotspots sur données réelles)
// ─────────────────────────────────────────────────────────────
function AerialPhotoView({
  view,
  units,
  blockTargets,
  titleDeed,
  onSelectUnit,
}: {
  view: ComplexView;
  units: { id: string }[];
  blockTargets: BlockTarget[];
  titleDeed: string;
  onSelectUnit: (unitId: string) => void;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <div className="flex w-full flex-col items-center bg-cream-dim p-3 sm:p-6">
      <div className="relative w-full max-w-5xl">
        <img
          src={view.imageUrl}
          alt={view.title}
          className="h-auto w-full rounded-xl border border-line object-contain shadow-card"
          style={{ maxHeight: '75vh' }}
        />

        <button
          onClick={() => setLightboxOpen(true)}
          className="absolute right-3 top-3 z-30 rounded-full border border-white/30 bg-ink/80 p-2.5 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-laterite"
          aria-label="Agrandir la vue en plein écran"
          title="Agrandir"
        >
          <Maximize className="h-4 w-4" />
        </button>

        {view.hotspots && view.hotspots.length > 0 && (
          <div className="absolute inset-0">
            {view.hotspots.map((hotspot) => {
              if (hotspot.targetType === 'BLOCK') {
                const target = blockTargets.find((block) => block.id === hotspot.targetId);
                if (!target) return null;
                return (
                  <div
                    key={hotspot.id}
                    style={{ top: hotspot.top, left: hotspot.left }}
                    className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
                  >
                    <button
                      onClick={() => onSelectUnit(target.unitId)}
                      className="group/hs relative flex items-center gap-2 rounded-full border-2 border-white bg-ink/90 px-3 py-1.5 text-xs font-medium text-white shadow-xl transition-all hover:scale-110 hover:bg-laterite"
                    >
                      <span className="absolute -left-1 -top-1 h-2.5 w-2.5 animate-ping rounded-full bg-laterite-light" />
                      <LayoutGrid className="h-3.5 w-3.5" />
                      <span className="hidden font-semibold sm:inline">{hotspot.label}</span>
                      <ChevronRight className="h-3 w-3 transition-transform group-hover/hs:translate-x-0.5" />
                    </button>
                  </div>
                );
              }

              const matchedUnit = resolveHotspotTarget(hotspot.targetId, units);
              if (!matchedUnit) return null;
              return (
                <div
                  key={hotspot.id}
                  style={{ top: hotspot.top, left: hotspot.left }}
                  className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
                >
                  <button
                    onClick={() => onSelectUnit(matchedUnit.id)}
                    className="group/hs relative flex items-center gap-2 rounded-full border-2 border-white bg-ink/90 px-3 py-1.5 text-xs font-medium text-white shadow-xl transition-all hover:scale-110 hover:bg-laterite"
                  >
                    <span className="absolute -left-1 -top-1 h-2.5 w-2.5 animate-ping rounded-full bg-laterite-light" />
                    <Building className="h-3.5 w-3.5" />
                    <span className="hidden font-semibold sm:inline">{hotspot.label}</span>
                    <ChevronRight className="h-3 w-3 transition-transform group-hover/hs:translate-x-0.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-3 flex w-full max-w-5xl flex-col items-start justify-between gap-3 rounded-xl border border-line bg-white p-4 shadow-card sm:flex-row sm:items-center">
        <div>
          <h4 className="font-serif text-sm font-semibold text-ink">{view.subtitle || view.title}</h4>
          {view.description && (
            <p className="mt-1 text-xs leading-relaxed text-muted">{view.description}</p>
          )}
        </div>
        {titleDeed && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-lagoon/20 bg-lagoon/10 px-2.5 py-1 text-[11px] font-medium text-lagoon">
            <ShieldCheck className="h-3.5 w-3.5" /> {titleDeed}
          </span>
        )}
      </div>

      <ImageLightbox
        src={view.imageUrl}
        alt={view.title}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// VIEWER PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function ComplexOverviewViewer({
  views,
  units,
  blockTargets,
  blockViewsMap,
  residenceInfo,
  onSelectUnit,
}: ComplexOverviewViewerProps) {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [activeViewId, setActiveViewId] = useState<string>('');

  const allBlockIds = blockTargets.map((target) => target.id);
  const hasBlockTabs = allBlockIds.length > 0;

  const currentViews =
    activeTab === 'overview' ? views : (blockViewsMap[activeTab] ?? []);
  const activeView = selectActiveView(currentViews, activeViewId);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    const viewsForTab = tabId === 'overview' ? views : (blockViewsMap[tabId] ?? []);
    setActiveViewId(viewsForTab[0]?.id ?? '');
  };

  const blockLabel = (blockId: string) =>
    blockTargets.find((target) => target.id === blockId)?.name ?? 'Bloc';

  if (!activeView) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-muted">Aucune vue disponible pour cette résidence.</p>
      </div>
    );
  }

  const meta = [
    residenceInfo.titleDeed,
    residenceInfo.totalLandArea,
  ].filter((value) => value.trim().length > 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      {hasBlockTabs && (
        <div className="flex flex-wrap gap-1.5 border-b border-line bg-cream px-4 pb-0 pt-3 sm:px-5">
          <button
            onClick={() => handleTabChange('overview')}
            className={`rounded-t-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${
              activeTab === 'overview'
                ? 'border border-line border-b-white bg-white font-semibold text-ink'
                : 'text-muted hover:bg-ink/5 hover:text-ink'
            }`}
          >
            <LayoutGrid className="mr-1.5 inline h-3 w-3 -translate-y-px" />
            Vue d&apos;ensemble
          </button>
          {allBlockIds.map((id) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`rounded-t-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${
                activeTab === id
                  ? 'border border-line border-b-white bg-white font-semibold text-ink'
                  : 'text-muted hover:bg-ink/5 hover:text-ink'
              }`}
            >
              <Building className="mr-1.5 inline h-3 w-3 -translate-y-px" />
              {blockLabel(id)}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col items-start justify-between gap-4 border-b border-line bg-white p-4 sm:p-5 lg:flex-row lg:items-center">
        <div>
          <div className="eyebrow mb-1 flex items-center gap-2 text-laterite">
            <Sparkles className="h-3.5 w-3.5" />
            {activeTab === 'overview'
              ? ['Vue d’ensemble', ...meta].join(' · ')
              : [blockLabel(activeTab), residenceInfo.titleDeed].filter(Boolean).join(' · ')}
          </div>
          <h2 className="font-serif text-xl font-semibold text-ink sm:text-2xl">
            {activeView.title}
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {currentViews.map((view) => (
            <button
              key={view.id}
              onClick={() => setActiveViewId(view.id)}
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition-all ${
                activeViewId === view.id || (!activeViewId && view.id === currentViews[0]?.id)
                  ? 'border-laterite bg-laterite text-white shadow-card'
                  : 'border-line bg-white text-muted hover:border-ink/20 hover:text-ink'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              {view.title}
            </button>
          ))}
        </div>
      </div>

      <AerialPhotoView
        view={activeView}
        units={units}
        blockTargets={blockTargets}
        titleDeed={residenceInfo.titleDeed}
        onSelectUnit={onSelectUnit}
      />

      {/* Métriques : uniquement les données réellement renseignées. */}
      <div className="grid grid-cols-2 divide-x divide-line border-t border-line bg-cream sm:grid-cols-4">
        {residenceInfo.totalLandArea && (
          <div className="p-3.5 text-center">
            <span className="block text-[10px] uppercase tracking-wide text-muted">Terrain global</span>
            <span className="text-sm font-semibold text-ink">{residenceInfo.totalLandArea}</span>
          </div>
        )}
        {residenceInfo.deliveryDate && (
          <div className="p-3.5 text-center">
            <span className="block text-[10px] uppercase tracking-wide text-muted">Livraison estimée</span>
            <span className="text-sm font-semibold text-ink">{residenceInfo.deliveryDate}</span>
          </div>
        )}
        {residenceInfo.notaryName && (
          <div className="p-3.5 text-center">
            <span className="block text-[10px] uppercase tracking-wide text-muted">Notaire référent</span>
            <span className="text-sm font-semibold text-ink">{residenceInfo.notaryName}</span>
          </div>
        )}
        {residenceInfo.escrowBank && (
          <div className="p-3.5 text-center">
            <span className="block text-[10px] uppercase tracking-wide text-muted">Compte séquestre</span>
            <span className="text-sm font-semibold text-ink">{residenceInfo.escrowBank}</span>
          </div>
        )}
      </div>
    </div>
  );
}
