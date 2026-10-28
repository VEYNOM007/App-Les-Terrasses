import React from 'react';
import {
  MARKET_STUDY_DISCLAIMER,
  MARKET_STUDY_MODE,
  SURVEY_PATH,
} from '../lib/market-mode';

/**
 * Bandeau discret affiché sous l'en-tête public en mode étude de marché.
 * Ne rend rien lorsque le mode vente est réactivé.
 */
export default function MarketStudyBanner() {
  if (!MARKET_STUDY_MODE) return null;

  return (
    <div className="border-b border-line bg-cream-dim">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-6 lg:px-8">
        <p className="flex items-center gap-2 text-xs font-medium text-ink/80">
          <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-laterite" />
          {MARKET_STUDY_DISCLAIMER}
        </p>
        <a
          href={SURVEY_PATH}
          className="text-xs font-semibold text-laterite underline-offset-4 hover:underline"
        >
          Donner mon avis →
        </a>
      </div>
    </div>
  );
}
