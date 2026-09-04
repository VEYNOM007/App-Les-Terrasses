'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, RefreshCw } from 'lucide-react';
import ImageLightbox from '../ImageLightbox';
import { fetchTypologies, fetchUnit } from '../../lib/api';
import {
  buildCards,
  selectRepresentativeUnit,
  UnitCard,
} from '../../lib/catalog/catalogue-grid';

const FILTERS = [
  { key: 'ALL', label: 'Tous' },
  { key: 'STUDIO', label: 'Studios' },
  { key: 'T2', label: 'T2' },
  { key: 'T3', label: 'T3' },
  { key: 'T5', label: 'T5' },
  { key: 'COMMERCE', label: 'Commerces' },
] as const;

function CardThumbnail({ card }: { card: UnitCard }) {
  return (
    <div className="relative h-52 bg-ink-dark overflow-hidden group/img">
      {card.thumbnailUrl ? (
        <img
          src={card.thumbnailUrl}
          alt={card.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-105"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-paper/40 font-mono text-xs">
          Visuel à venir
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent opacity-80" />

      {card.thumbnailIsRendu3D && (
        <span className="absolute top-4 left-4 z-10 text-[10px] font-mono bg-ink/80 backdrop-blur-md text-sand border border-paper/20 px-2.5 py-1 rounded-md">
          Vue d'artiste
        </span>
      )}

      <div className="absolute bottom-3 right-3 text-[11px] font-mono bg-lagoon/20 text-lagoon-light border border-lagoon/40 px-2 py-0.5 rounded">
        {card.availableUnitsCount} dispo / {card.totalUnitsCount}
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
    <div className="bg-ink-card border border-paper/20 rounded-xl overflow-hidden hover:border-sand transition-all flex flex-col justify-between group relative shadow-xl">
      {card.statusBadge && (
        <span className="absolute top-4 right-4 z-10 text-[10px] font-mono bg-laterite/80 backdrop-blur-md text-paper border border-paper/30 px-2.5 py-1 rounded-md shadow-md">
          {card.statusBadge}
        </span>
      )}

      <button
        type="button"
        onClick={() => card.thumbnailUrl && setLightboxOpen(true)}
        className="block w-full text-left cursor-pointer"
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
        <div className="text-[11px] font-mono text-sand uppercase mb-1">
          {card.blockName} · Étage {card.floor}
        </div>
        <h3 className="font-serif text-xl font-semibold text-paper">{card.name}</h3>
        <div className="text-xs font-mono text-paper/60 mt-1">
          Surface utile : <strong className="text-paper">{card.surface} m²</strong>
        </div>
      </div>

      <div className="p-5 pt-0 border-t border-paper/15 mt-4 space-y-3">
        <div className="flex justify-between items-baseline pt-3">
          <span className="text-[10px] font-mono text-paper/50 uppercase">À PARTIR DE</span>
          <span className="font-mono text-base text-laterite-light font-bold">
            {card.priceFormatted}
          </span>
        </div>

        {card.isSoldOut ? (
          <button
            disabled
            className="w-full bg-paper/5 border border-paper/15 text-paper/50 font-mono text-xs py-2.5 rounded-lg cursor-not-allowed"
          >
            Épuisé · sur liste d'attente
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onOpenUnit(card.id)}
              className="bg-paper/10 hover:bg-paper/20 text-paper font-mono text-xs py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all"
            >
              <Eye className="w-3.5 h-3.5 text-sand" /> Fiche détaillée
            </button>
            <button
              onClick={() => onOpenReservation(card.id)}
              className="bg-laterite hover:bg-laterite-light text-paper font-mono text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all"
            >
              Réserver
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-ink-card border border-paper/20 rounded-xl overflow-hidden animate-pulse">
          <div className="h-52 bg-ink-dark" />
          <div className="p-5 space-y-3">
            <div className="h-3 w-24 bg-ink-dark rounded" />
            <div className="h-5 w-40 bg-ink-dark rounded" />
            <div className="h-3 w-32 bg-ink-dark rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="bg-ink-card border border-paper/20 rounded-xl p-10 text-center space-y-4">
      <p className="font-mono text-xs text-paper/70">{message}</p>
      <button
        onClick={onRetry}
        className="bg-laterite hover:bg-laterite-light text-paper font-mono text-xs px-5 py-3 rounded-lg inline-flex items-center gap-2 transition-all"
      >
        <RefreshCw className="w-3.5 h-3.5" /> Réessayer
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger le catalogue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleCards = useMemo(
    () => (filterType === 'ALL' ? cards : cards.filter((card) => card.type === filterType)),
    [cards, filterType],
  );

  const totalUnits = useMemo(
    () => cards.reduce((sum, card) => sum + card.totalUnitsCount, 0),
    [cards],
  );

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-paper/15">
        <div>
          <span className="text-xs font-mono text-sand uppercase">
            Vente en l'État Futur d'Achèvement (VEFA)
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-paper">
            Découvrez les Typologies Disponibles
          </h2>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-mono">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterType(f.key)}
              className={`px-3 py-2 rounded-lg border transition-all ${
                filterType === f.key
                  ? 'bg-laterite text-paper border-laterite font-bold'
                  : 'bg-ink border-paper/15 text-paper/70 hover:border-paper/40'
              }`}
            >
              {f.label}
              {f.key === 'ALL' ? ` (${totalUnits})` : null}
            </button>
          ))}
        </div>
      </div>

      {loading && <GridSkeleton />}

      {error && <ErrorPanel message={error} onRetry={() => void load()} />}

      {!loading && !error && visibleCards.length === 0 && (
        <div className="bg-ink-card border border-paper/20 rounded-xl p-10 text-center font-mono text-xs text-paper/70">
          Aucune typologie disponible pour le moment.
        </div>
      )}

      {!loading && !error && visibleCards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
    </>
  );
}
