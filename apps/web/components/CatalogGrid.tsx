'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Home, RefreshCw } from 'lucide-react';
import { fetchTypologies, TypologyGroup, UnitType } from '../lib/api';
import { MARKET_STUDY_MODE } from '../lib/market-mode';

const TYPE_LABELS: Record<UnitType, string> = {
  STUDIO: 'Studio',
  T2: 'T2',
  T3: 'T3',
  T4: 'T4',
  T5: 'T5',
  COMMERCE: 'Local commercial',
};

const TYPE_ORDER: UnitType[] = ['STUDIO', 'T2', 'T3', 'T4', 'T5', 'COMMERCE'];

function formatPrice(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 'Prix sur demande';
  return `${new Intl.NumberFormat('fr-FR').format(amount)} FCFA`;
}

function surfaceLabel(group: TypologyGroup): string {
  const surfaces = group.units
    .map((unit) => unit.surface)
    .filter((surface): surface is number => Number.isFinite(surface) && surface > 0);

  if (surfaces.length === 0) return 'Surface sur plan';
  const min = Math.min(...surfaces);
  const max = Math.max(...surfaces);
  return min === max ? `${min} m²` : `${min} – ${max} m²`;
}

function TypologyCard({ group }: { group: TypologyGroup }) {
  return (
    <article className="card flex h-full flex-col p-6 transition-shadow hover:shadow-lift">
      <div className="flex items-center justify-between">
        <span className="eyebrow text-muted">
          {group.totalUnits} logement{group.totalUnits > 1 ? 's' : ''}
        </span>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cream-dim text-laterite">
          <Home className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>

      <h3 className="mt-4 font-serif text-2xl font-semibold text-ink">
        {TYPE_LABELS[group.type] ?? group.type}
      </h3>
      <p className="mt-1 text-sm text-muted">{surfaceLabel(group)}</p>

      <div className="mt-6 flex items-baseline justify-between gap-3 border-t border-line pt-4">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
          {MARKET_STUDY_MODE ? 'Prix indicatif' : 'À partir de'}
        </span>
        <span className="text-sm font-semibold text-laterite">
          {formatPrice(group.minPrice)}
        </span>
      </div>

      <a href="/catalogue" className="btn-outline mt-5 w-full !py-2.5 !text-xs">
        Voir la fiche <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </a>
    </article>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="card animate-pulse p-6">
          <div className="h-3 w-20 rounded bg-cream-deep" />
          <div className="mt-5 h-7 w-32 rounded bg-cream-deep" />
          <div className="mt-3 h-3 w-24 rounded bg-cream-deep" />
          <div className="mt-8 h-10 w-full rounded-lg bg-cream-deep" />
        </div>
      ))}
    </div>
  );
}

export default function CatalogGrid() {
  const [groups, setGroups] = useState<TypologyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchTypologies();
      const sorted = [...data].sort(
        (a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type),
      );
      setGroups(sorted);
    } catch (cause) {
      console.warn('[accueil] catalogue indisponible :', cause);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section id="catalogue" className="scroll-mt-24 bg-cream py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <p className="eyebrow text-laterite">Les typologies</p>
            <h2 className="mt-3 font-serif text-3xl font-semibold leading-tight text-ink sm:text-4xl">
              Du studio au T5, un même standard de finition
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted">
              Les surfaces et les prix ci-dessous sont ceux du projet tel
              qu&apos;il est étudié aujourd&apos;hui. Ils seront confirmés avant
              toute commercialisation.
            </p>
          </div>
          <a href="/catalogue" className="btn-outline shrink-0">
            Ouvrir le catalogue 3D <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>

        <div className="mt-10">
          {loading && <GridSkeleton />}

          {!loading && error && (
            <div className="card flex flex-col items-center gap-4 p-10 text-center">
              <p className="text-sm text-ink">
                Le catalogue est momentanément indisponible.
              </p>
              <p className="text-xs text-muted">
                Réessayez dans un instant ; vos données ne sont pas en cause.
              </p>
              <button onClick={() => void load()} className="btn-outline !py-2.5 !text-xs">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Réessayer
              </button>
            </div>
          )}

          {!loading && !error && groups.length === 0 && (
            <div className="card p-10 text-center text-sm text-muted">
              Le catalogue est en cours de mise à jour.
            </div>
          )}

          {!loading && !error && groups.length > 0 && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((group) => (
                <TypologyCard key={group.type} group={group} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
