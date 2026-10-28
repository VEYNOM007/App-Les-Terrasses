'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, RefreshCw } from 'lucide-react';
import ImageLightbox from '../ImageLightbox';
import { fetchTypologies, fetchUnit } from '../../lib/api';
import {
  buildCards,
  selectRepresentativeUnit,
  TYPE_LABELS,
  UnitCard,
} from '../../lib/catalog/catalogue-grid';
import { MARKET_STUDY_MODE } from '../../lib/market-mode';

function CardThumbnail({ card }: { card: UnitCard }) {
  return (
    <div className="group/img relative h-52 overflow-hidden bg-cream-deep">
      {card.thumbnailUrl ? (
        <img
          src={card.thumbnailUrl}
          alt={card.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover/img:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-mono text-xs text-muted">
          Visuel à venir
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-ink/25 via-transparent to-transparent" />

      {card.thumbnailIsRendu3D && (
        <span className="absolute left-4 top-4 z-10 rounded-md border border-white/40 bg-ink/80 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
          Vue d&apos;artiste
        </span>
      )}

      <div className="absolute bottom-3 right-3 rounded-md border border-white/50 bg-white/90 px-2 py-0.5 text-[11px] font-medium text-ink">
        {MARKET_STUDY_MODE
          ? `${card.totalUnitsCount} logement${card.totalUnitsCount > 1 ? 's' : ''}`
          : `${card.availableUnitsCount} dispo / ${card.totalUnitsCount}`}
      </div>
    </div>
  );
}

function UnitCardView({
  card,
  onOpenUnit,
  onOpenReservation,
}: {
  card: UnitCard;
  onOpenUnit: (unitId: string) => void;
  onOpenReservation: (unitId: string) => void;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <article className="card flex flex-col justify-between overflow-hidden transition-shadow hover:shadow-lift">
      <button
        type="button"
        onClick={() => card.thumbnailUrl && setLightboxOpen(true)}
        className="block w-full text-left"
        aria-label={card.thumbnailUrl ? `Agrandir le visuel de ${card.name}` : card.name}
      >
        <CardThumbnail card={card} />
      </button>
      {card.thumbnailUrl && (
        <ImageLightbox
          src={card.thumbnailUrl}
          alt={card.name}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      <div className="p-5">
        <div className="eyebrow mb-1 text-muted">
          {card.blockName} · Étage {card.floor}
        </div>
        <h3 className="font-serif text-xl font-semibold text-ink">{card.name}</h3>
        <div className="mt-1 text-sm text-muted">
          Surface utile : <strong className="font-semibold text-ink">{card.surface} m²</strong>
        </div>
      </div>

      <div className="mt-2 border-t border-line p-5 pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
            {MARKET_STUDY_MODE ? 'Prix indicatif' : 'À partir de'}
          </span>
          <span className="text-base font-semibold text-laterite">{card.priceFormatted}</span>
        </div>

        <div className="mt-4">
          {MARKET_STUDY_MODE || card.isSoldOut ? (
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => onOpenUnit(card.id)}
                className="btn-outline w-full !py-2.5 !text-xs"
              >
                <Eye className="h-3.5 w-3.5" /> Fiche détaillée
              </button>
              {!MARKET_STUDY_MODE && card.isSoldOut && (
                <span className="text-center text-[11px] text-muted">Complet</span>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onOpenUnit(card.id)}
                className="btn-outline !py-2.5 !text-xs"
              >
                <Eye className="h-3.5 w-3.5" /> Fiche
              </button>
              <button
                onClick={() => onOpenReservation(card.id)}
                className="btn-primary !py-2.5 !text-xs"
              >
                Réserver
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="card animate-pulse overflow-hidden">
          <div className="h-52 bg-cream-deep" />
          <div className="space-y-3 p-5">
            <div className="h-3 w-24 rounded bg-cream-deep" />
            <div className="h-5 w-40 rounded bg-cream-deep" />
            <div className="h-3 w-32 rounded bg-cream-deep" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card p-10 text-center">
      <p className="text-sm text-ink">{message}</p>
      <p className="mt-2 text-xs text-muted">Réessayez dans un instant.</p>
      <button onClick={onRetry} className="btn-outline mt-5 !py-2.5 !text-xs">
        <RefreshCw className="h-3.5 w-3.5" /> Réessayer
      </button>
    </div>
  );
}

interface CatalogueGridProps {
  onOpenUnit: (unitId: string) => void;
  onOpenReservation: (unitId: string) => void;
}

export default function CatalogueGrid({ onOpenUnit, onOpenReservation }: CatalogueGridProps) {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [cards, setCards] = useState<UnitCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const groups = await fetchTypologies();
      const representativeIds = groups
        .map((group) => selectRepresentativeUnit(group.units)?.id)
        .filter((id): id is string => id !== undefined);
      const units = await Promise.all(representativeIds.map((id) => fetchUnit(id)));
      setCards(buildCards(groups, units));
    } catch (cause) {
      console.warn('[catalogue] grille indisponible :', cause);
      setError('Le catalogue est momentanément indisponible.');
    } finally {
      setLoading(false);
    }
  }, []);

  const filters = useMemo(() => {
    const types = Array.from(new Set(cards.map((card) => card.type)));
    return [
      { key: 'ALL', label: 'Tous' },
      ...types.map((type) => ({ key: type, label: TYPE_LABELS[type] ?? type })),
    ];
  }, [cards]);

  useEffect(() => {
    void load();
  }, [load]);

  // Si le filtre actif disparaît après un rechargement, on retombe sur « Tous ».
  useEffect(() => {
    if (filterType !== 'ALL' && !filters.some((filter) => filter.key === filterType)) {
      setFilterType('ALL');
    }
  }, [filterType, filters]);

  const visibleCards = useMemo(
    () => (filterType === 'ALL' ? cards : cards.filter((card) => card.type === filterType)),
    [cards, filterType],
  );

  const totalUnits = useMemo(
    () => cards.reduce((sum, card) => sum + card.totalUnitsCount, 0),
    [cards],
  );

  const showCount = !loading && !error && cards.length > 0;

  return (
    <>
      <div className="flex flex-col justify-between gap-6 border-b border-line pb-6 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <span className="eyebrow text-laterite">
            {MARKET_STUDY_MODE ? 'Les typologies étudiées' : 'Les typologies'}
          </span>
          <h2 className="mt-2 font-serif text-2xl font-semibold text-ink sm:text-3xl">
            Découvrez les typologies du projet
          </h2>
          {MARKET_STUDY_MODE && (
            <p className="mt-2 text-sm text-muted">
              Prix et plans indicatifs · aucune vente en cours.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {filters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setFilterType(filter.key)}
              className={`rounded-lg border px-3 py-2 font-medium transition-all ${
                filterType === filter.key
                  ? 'border-laterite bg-laterite text-white'
                  : 'border-line bg-white text-muted hover:border-ink/25 hover:text-ink'
              }`}
            >
              {filter.label}
              {filter.key === 'ALL' && showCount ? ` (${totalUnits})` : null}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8">
        {loading && <GridSkeleton />}

        {!loading && error && <ErrorPanel message={error} onRetry={() => void load()} />}

        {!loading && !error && visibleCards.length === 0 && (
          <div className="card p-10 text-center text-sm text-muted">
            Aucune typologie disponible pour le moment.
          </div>
        )}

        {!loading && !error && visibleCards.length > 0 && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {visibleCards.map((card) => (
              <UnitCardView
                key={card.id}
                card={card}
                onOpenUnit={onOpenUnit}
                onOpenReservation={onOpenReservation}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
