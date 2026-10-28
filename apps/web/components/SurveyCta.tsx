import React from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { SURVEY_PATH } from '../lib/market-mode';

const POINTS = [
  'Votre résidence et votre lien avec le Togo',
  'Le type de logement que vous cherchez',
  'Votre budget et la taille souhaitée',
  'Ce qui vous freine et ce qui vous rassure',
] as const;

export default function SurveyCta() {
  return (
    <section id="avis" className="scroll-mt-24 bg-cream-dim py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="card overflow-hidden">
          <div className="grid lg:grid-cols-5">
            <div className="p-8 sm:p-12 lg:col-span-3">
              <p className="eyebrow text-laterite">Votre avis</p>
              <h2 className="mt-3 font-serif text-3xl font-semibold leading-tight text-ink sm:text-4xl">
                Les Terrasses de Baguida : donnez votre avis
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted">
                Projet à l&apos;étude, sans engagement ni paiement.
                2 minutes, anonyme.
              </p>

              <ul className="mt-7 grid gap-3 sm:grid-cols-2">
                {POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-sm text-ink/80">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-lagoon" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>

              <a href={SURVEY_PATH} className="btn-primary mt-8">
                Répondre au questionnaire
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>

            <div className="bg-ink p-8 text-paper sm:p-12 lg:col-span-2">
              <p className="eyebrow text-sand">Pourquoi répondre</p>
              <p className="mt-4 font-serif text-2xl leading-snug text-paper">
                Vos réponses orientent les typologies, les prix et les plans
                avant le lancement du projet.
              </p>
              <p className="mt-5 text-sm leading-relaxed text-paper/70">
                Aucune donnée n&apos;est vendue ni transmise à un tiers. Le
                contact est facultatif et stocké séparément des réponses.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
