'use client';

import React from 'react';
import { BarChart3, BellRing, ClipboardList, Ruler } from 'lucide-react';
import { MARKET_STUDY_MODE, SURVEY_PATH } from '../lib/market-mode';

const STEPS = [
  {
    num: '01',
    title: 'Vous donnez votre avis',
    desc: 'Douze questions, deux minutes, sans engagement. Le questionnaire est anonyme : le contact est facultatif.',
    icon: ClipboardList,
  },
  {
    num: '02',
    title: 'Les besoins sont consolidés',
    desc: 'Typologies, budgets, freins et attentes : les réponses sont agrégées pour comprendre la demande réelle.',
    icon: BarChart3,
  },
  {
    num: '03',
    title: 'Le projet est affiné',
    desc: 'Plans, prix et découpage des lots sont ajustés. Le titre foncier est vérifié par le notaire avant toute commercialisation.',
    icon: Ruler,
  },
  {
    num: '04',
    title: 'Vous êtes prévenu en priorité',
    desc: 'Les personnes qui laissent un contact sont informées en premier lorsque le projet entre dans sa phase suivante.',
    icon: BellRing,
  },
] as const;

export default function Mechanism() {
  return (
    <section id="demarche" className="scroll-mt-24 border-y border-line bg-cream-dim py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="eyebrow text-laterite">La démarche</p>
          <h2 className="mt-3 font-serif text-3xl font-semibold leading-tight text-ink sm:text-4xl">
            Ce projet se construit d&apos;abord avec vous
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted">
            À ce stade, il n&apos;y a ni vente ni paiement. Nous consolidons la
            demande avant de figer les plans, les prix et le calendrier.
          </p>
        </div>

        <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ num, title, desc, icon: Icon }) => (
            <li key={num} className="card flex flex-col p-6">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-medium text-laterite">
                  {num} / ÉTAPE
                </span>
                <Icon className="h-5 w-5 text-laterite/70" aria-hidden="true" />
              </div>
              <h3 className="mt-5 font-serif text-lg font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{desc}</p>
            </li>
          ))}
        </ol>

        {MARKET_STUDY_MODE && (
          <div className="mt-12 flex flex-col items-start justify-between gap-4 rounded-2xl border border-laterite/20 bg-white p-6 shadow-card sm:flex-row sm:items-center">
            <p className="text-sm leading-relaxed text-ink/80">
              <strong className="font-semibold text-ink">Deux minutes suffisent.</strong>{' '}
              Votre avis nous aide à décider ce qui sera construit, et à quel prix.
            </p>
            <a href={SURVEY_PATH} className="btn-primary shrink-0">
              Donnez votre avis
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
