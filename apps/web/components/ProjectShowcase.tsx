'use client';

import React, { useState } from 'react';
import { ArrowRight, Expand, MapPin, ShieldCheck, Trees } from 'lucide-react';
import ImageLightbox from './ImageLightbox';
import { MARKET_STUDY_MODE, SURVEY_PATH } from '../lib/market-mode';

const FACTS = [
  {
    icon: MapPin,
    title: 'Baguida, à l’est de Lomé',
    detail: 'Un terrain arboré, à quelques minutes du littoral.',
  },
  {
    icon: ShieldCheck,
    title: 'Résidence fermée',
    detail: 'Un accès unique, des stationnements et des commerces de proximité.',
  },
  {
    icon: Trees,
    title: 'Des espaces plantés',
    detail: 'Un parc central, des terrasses et des circulations piétonnes.',
  },
] as const;

export default function ProjectShowcase() {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <section id="projet" className="scroll-mt-24 bg-cream py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="eyebrow text-laterite">Le projet</p>
            <h2 className="mt-3 font-serif text-3xl font-semibold leading-tight text-ink sm:text-4xl">
              Une résidence pensée pour Lomé et pour la diaspora
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted">
              Les Terrasses de Baguida prévoit des studios, des T2, des T3 et
              des T4 dans une résidence fermée, avec des espaces communs
              plantés. Le projet est encore à l&apos;étude : les plans, les
              typologies et les prix seront affinés avec les réponses au
              questionnaire.
            </p>

            <ul className="mt-8 space-y-5">
              {FACTS.map(({ icon: Icon, title, detail }) => (
                <li key={title} className="flex gap-4">
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-laterite shadow-card">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-ink">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{detail}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a href={MARKET_STUDY_MODE ? SURVEY_PATH : '/catalogue'} className="btn-primary">
                {MARKET_STUDY_MODE ? 'Donnez votre avis' : 'Voir le catalogue'}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a href="/catalogue" className="btn-outline">
                Explorer le catalogue 3D
              </a>
            </div>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="group block w-full overflow-hidden rounded-3xl border border-line bg-white p-2 shadow-lift"
              aria-label="Agrandir le plan de masse"
            >
              <img
                src="/masterplan-les-terrasses.jpg"
                alt="Plan de masse du projet : blocs résidentiels, commerces, parking et parc central"
                className="h-auto w-full rounded-2xl object-cover transition-transform duration-500 group-hover:scale-[1.01]"
                loading="lazy"
              />
              <span className="absolute bottom-5 right-5 inline-flex items-center gap-2 rounded-xl bg-ink/85 px-3 py-2 text-xs font-medium text-white backdrop-blur-sm">
                <Expand className="h-3.5 w-3.5" aria-hidden="true" />
                Agrandir
              </span>
            </button>
            <p className="mt-3 text-center text-xs text-muted">
              Aperçu du projet · plan indicatif
            </p>
          </div>
        </div>
      </div>

      <ImageLightbox
        src="/masterplan-les-terrasses.jpg"
        alt="Plan de masse du projet Les Terrasses de Baguida"
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </section>
  );
}
