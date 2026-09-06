'use client';

import React from 'react';

function TerraceIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="0" y="2" width="48" height="9" rx="1.5" fill="currentColor" />
      <rect x="13" y="14" width="35" height="9" rx="1.5" fill="currentColor" />
      <rect x="26" y="26" width="22" height="9" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export interface BrandProps {
  compact?: boolean;
  wordmarkClassName?: string;
}

export default function Brand({ compact = false, wordmarkClassName = 'text-xl' }: BrandProps) {
  return (
    <span className="inline-flex flex-col items-start gap-1.5 leading-none">
      <span className="inline-flex items-center gap-2.5">
        <TerraceIcon className="w-6 h-6 text-laterite-light shrink-0" />
        <span className={`font-serif font-semibold tracking-tight text-paper leading-tight ${wordmarkClassName}`}>
          <span className={compact ? 'sm:hidden' : 'hidden'}>Immo</span>
          <span className={compact ? 'hidden sm:inline' : 'inline'}>
            Immo<span className="text-laterite-light">·</span>Les Terrasses
          </span>
        </span>
      </span>
      {!compact && (
        <span className="hidden sm:block font-mono text-[10px] uppercase tracking-[0.3em] text-paper/50">
          Résidences · Lomé, Togo
        </span>
      )}
    </span>
  );
}