'use client';

import React from 'react';
import { ArrowRight, MapPin } from 'lucide-react';
import { MARKET_STUDY_MODE, SURVEY_PATH } from '../lib/market-mode';

export default function Hero() {
  const primaryHref = MARKET_STUDY_MODE ? SURVEY_PATH : '/catalogue';
  const primaryLabel = MARKET_STUDY_MODE
    ? 'Donnez votre avis (2 min)'
    : 'Réserver ma place';

  return (
    <section className="relative isolate overflow-hidden bg-ink text-white">
      {/* Rendu aérien réel du projet — aucune image inventée. */}
      <img
        src="/masterplan-les-terrasses.jpg"
        alt="Rendu aérien de la résidence Les Terrasses : quatre bâtiments, jardins et parking"
        className="absolute inset-0 h-full w-full object-cover object-[58%_center] sm:object-center"
        loading="eager"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/90 to-ink/55 sm:bg-gradient-to-r sm:from-ink sm:via-ink/85 sm:to-ink/20" />

      <div className="relative mx-auto flex min-h-[calc(100svh-8rem)] max-w-7xl flex-col justify-end px-4 pb-8 pt-14 sm:min-h-[78vh] sm:justify-center sm:px-6 sm:pb-20 sm:pt-24 lg:px-8">
        <div className="max-w-2xl">
          <p className="eyebrow flex items-center gap-2 text-sand">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            Gbodjomé · Lomé · Togo
          </p>

          <h1 className="mt-4 font-serif text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Votre appartement à Lomé,{' '}
            <em className="italic text-laterite-light">conçu avec vous</em>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
            Studios, T2, T3 et T4 dans une résidence fermée à Gbodjomé.
            Le projet est à l&apos;étude : vos réponses orientent les
            typologies, les prix et les plans.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a href={primaryHref} className="btn-primary">
              {primaryLabel} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <a href="#projet" className="btn-ghost">
              Découvrir le projet
            </a>
          </div>

          <p className="mt-4 text-xs text-white/60">
            2 minutes · sans engagement · anonyme
          </p>
        </div>
      </div>
    </section>
  );
}
