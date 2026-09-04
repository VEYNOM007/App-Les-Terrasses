'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface GalleryItem {
  src: string;
  alt: string;
}

interface ImageLightboxProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
  gallery?: GalleryItem[];
  initialIndex?: number;
}

export default function ImageLightbox({
  src,
  alt,
  isOpen,
  onClose,
  gallery,
  initialIndex = 0,
}: ImageLightboxProps) {
  const items = gallery ?? [{ src, alt }];
  const hasNav = items.length > 1;
  const [idx, setIdx] = useState(initialIndex);

  useEffect(() => {
    if (isOpen) setIdx(initialIndex);
  }, [isOpen, initialIndex]);

  const goPrev = useCallback(() => {
    setIdx((i) => (i === 0 ? items.length - 1 : i - 1));
  }, [items.length]);

  const goNext = useCallback(() => {
    setIdx((i) => (i === items.length - 1 ? 0 : i + 1));
  }, [items.length]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (hasNav) {
        if (e.key === 'ArrowLeft') goPrev();
        else if (e.key === 'ArrowRight') goNext();
      }
    },
    [onClose, hasNav, goPrev, goNext],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const current = items[idx] ?? items[0];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/95 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-paper/10 hover:bg-paper/20 text-paper/70 hover:text-paper transition-all z-10"
        aria-label="Fermer"
      >
        <X className="w-6 h-6" />
      </button>

      {hasNav && (
        <button
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-ink/80 hover:bg-laterite text-paper transition-all z-10"
          aria-label="Photo précédente"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      <img
        src={current.src}
        alt={current.alt}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      {hasNav && (
        <button
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-ink/80 hover:bg-laterite text-paper transition-all z-10"
          aria-label="Photo suivante"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {hasNav && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs font-mono text-paper/70 bg-ink/80 backdrop-blur-md border border-paper/20 px-3 py-1.5 rounded-full"
          onClick={(e) => e.stopPropagation()}
        >
          {idx + 1} / {items.length}
        </div>
      )}
    </div>
  );
}
