'use client';

import React, { useState } from 'react';
import type { UnitDetailView } from '../../lib/catalog/unit-detail';
import ImageLightbox from '../ImageLightbox';
import FinancialSimulator from './FinancialSimulator';
import { MARKET_STUDY_MODE, SURVEY_PATH } from '../../lib/market-mode';
import {
  X,
  Building,
  Maximize2,
  CheckCircle,
  Download,
  Calendar,
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Clock,
  ArrowRight,
  ImageOff,
  MessageCircle,
} from 'lucide-react';

interface Apartment3DModalProps {
  unit: UnitDetailView | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenReservation: (unitId: string) => void;
}

type ModalTab = '3d' | 'plan' | 'finance';

export default function Apartment3DModal({
  unit,
  isOpen,
  onClose,
  onOpenReservation,
}: Apartment3DModalProps) {
  const [activePhotoIdx, setActivePhotoIdx] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<ModalTab>('3d');
  const [showOptionModal, setShowOptionModal] = useState<boolean>(false);
  const [optionHeld, setOptionHeld] = useState<boolean>(false);
  const [photoLightboxOpen, setPhotoLightboxOpen] = useState(false);

  if (!isOpen || !unit) return null;

  const photos = unit.gallery.filter(
    (media) => media.type === 'RENDU_3D' || media.type === 'PHOTO' || media.type === 'PHOTO_REELLE',
  );
  const safeIdx = photos.length > 0 ? activePhotoIdx % photos.length : 0;
  const currentPhoto = photos[safeIdx];
  const planUrl = unit.planUrl;

  const handleDownloadPdf = () => {
    alert(`Téléchargement de la Plaquette Commerciale PDF & Fiche Technique : ${unit.typeLabel} ${unit.blockName}`);
  };

  const handleHoldOption = (event: React.FormEvent) => {
    event.preventDefault();
    setOptionHeld(true);
    setTimeout(() => {
      setShowOptionModal(false);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/60 p-3 backdrop-blur-sm sm:p-6">
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl">
        {/* En-tête */}
        <div className="flex shrink-0 items-center justify-between border-b border-line bg-white p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-laterite/20 bg-laterite/10 font-bold text-laterite">
              <Building className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="eyebrow text-laterite">{unit.blockName}</span>
                {unit.statusLabel && (
                  <span className="rounded border border-laterite/20 bg-laterite/10 px-2 py-0.5 text-[10px] font-medium text-laterite">
                    {unit.statusLabel}
                  </span>
                )}
              </div>
              <h3 className="font-serif text-xl font-semibold text-ink sm:text-2xl">
                {unit.typeLabel} · Étage {unit.floor}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg bg-cream-dim p-2 text-muted transition-colors hover:bg-cream-deep hover:text-ink"
            aria-label="Fermer la fiche"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Onglets */}
        <div className="flex shrink-0 flex-wrap gap-2 border-b border-line bg-cream px-4 py-2.5 text-xs sm:px-6">
          <button
            onClick={() => setActiveTab('3d')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-all ${
              activeTab === '3d'
                ? 'bg-laterite font-semibold text-white shadow-card'
                : 'text-muted hover:bg-white hover:text-ink'
            }`}
          >
            <Sparkles className="h-4 w-4" /> Vue & photos ({photos.length})
          </button>
          <button
            onClick={() => setActiveTab('plan')}
            disabled={!planUrl}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-all ${
              activeTab === 'plan'
                ? 'bg-laterite font-semibold text-white shadow-card'
                : planUrl
                  ? 'text-muted hover:bg-white hover:text-ink'
                  : 'cursor-not-allowed text-muted/50'
            }`}
          >
            <Maximize2 className="h-4 w-4" /> Plan coté
          </button>
          {/* Le simulateur d'échéancier reste dans le code ; il n'est pas exposé en étude de marché. */}
          {!MARKET_STUDY_MODE && (
            <button
              onClick={() => setActiveTab('finance')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-all ${
                activeTab === 'finance'
                  ? 'bg-laterite font-semibold text-white shadow-card'
                  : 'text-muted hover:bg-white hover:text-ink'
              }`}
            >
              <Calendar className="h-4 w-4" /> Échéancier de paiement
            </button>
          )}
        </div>

        {/* Contenu */}
        <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
          {activeTab === '3d' && (
            <div className="space-y-4">
              {currentPhoto ? (
                <>
                  <div className="group relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-line bg-cream-deep shadow-card">
                    <img
                      src={currentPhoto.url}
                      alt={currentPhoto.altText}
                      className="h-full w-full cursor-zoom-in object-cover"
                      onClick={() => setPhotoLightboxOpen(true)}
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent" />

                    <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 rounded-lg border border-white/20 bg-ink/80 p-3 backdrop-blur-md">
                      <div>
                        <span className="rounded border border-laterite/40 bg-laterite/30 px-2 py-0.5 text-[10px] uppercase text-white">
                          {currentPhoto.mediaLabel}
                        </span>
                        <h4 className="mt-1 font-serif text-sm font-semibold text-white">
                          {currentPhoto.altText}
                        </h4>
                      </div>
                      <span className="text-xs text-white/70">
                        {safeIdx + 1} / {photos.length}
                      </span>
                    </div>

                    {photos.length > 1 && (
                      <>
                        <button
                          onClick={() =>
                            setActivePhotoIdx((previous) =>
                              previous === 0 ? photos.length - 1 : previous - 1,
                            )
                          }
                          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-ink/70 p-2 text-white transition-colors hover:bg-laterite"
                          aria-label="Photo précédente"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() =>
                            setActivePhotoIdx((previous) =>
                              previous === photos.length - 1 ? 0 : previous + 1,
                            )
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-ink/70 p-2 text-white transition-colors hover:bg-laterite"
                          aria-label="Photo suivante"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </>
                    )}
                  </div>

                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {photos.map((photo, photoIdx) => (
                      <button
                        key={photo.id}
                        onClick={() => setActivePhotoIdx(photoIdx)}
                        className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                          safeIdx === photoIdx
                            ? 'scale-105 border-laterite'
                            : 'border-line opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={photo.url} alt={photo.altText} className="h-full w-full object-cover" />
                        <span className="absolute bottom-1 right-1 rounded bg-ink/80 px-1 text-[9px] text-white">
                          {photo.isRendu3D ? '3D' : 'PH'}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-2 rounded-xl border border-line bg-cream p-10 text-center text-xs text-muted">
                  <ImageOff className="mx-auto h-8 w-8 text-muted/60" />
                  <p>Aucun visuel disponible pour cette unité.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'plan' && planUrl && (
            <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-12">
              <div className="flex flex-col items-center rounded-xl border border-line bg-cream p-4 md:col-span-8">
                <span className="mb-2 text-xs uppercase text-muted">Plan d&apos;architecture coté</span>
                <img
                  src={planUrl}
                  alt="Plan d'architecture"
                  className="max-h-[400px] w-full rounded-lg border border-line bg-white object-contain"
                />
              </div>

              <div className="space-y-4 text-xs md:col-span-4">
                <div className="space-y-3 rounded-xl border border-line bg-white p-4 shadow-card">
                  <h4 className="font-serif text-sm font-semibold text-ink">Surfaces & localisation</h4>
                  <div className="space-y-2 border-t border-line pt-3">
                    <div className="flex justify-between">
                      <span className="text-muted">Surface habitable</span>
                      <span className="font-semibold text-ink">{unit.surfaceM2} m²</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Étage</span>
                      <span className="font-semibold text-ink">{unit.floor}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Bloc</span>
                      <span className="font-semibold text-lagoon">{unit.blockName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Façade</span>
                      <span className="font-semibold text-ink">{unit.blockFrontage}</span>
                    </div>
                  </div>
                </div>

                {unit.virtualTourUrl && (
                  <a
                    href={unit.virtualTourUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-lg border border-line bg-cream px-4 py-3 text-xs text-ink transition-colors hover:bg-cream-deep"
                  >
                    <Layers className="h-4 w-4 text-laterite" /> Visite virtuelle 360°
                  </a>
                )}
              </div>
            </div>
          )}

          {!MARKET_STUDY_MODE && activeTab === 'finance' && <FinancialSimulator unitId={unit.id} />}

          {unit.description && (
            <div className="rounded-xl border border-line bg-cream p-4">
              <p className="text-sm leading-relaxed text-ink/80">{unit.description}</p>
            </div>
          )}

          {unit.highlights.length > 0 && (
            <div className="rounded-xl border border-line bg-white p-4">
              <div className="flex flex-wrap gap-2">
                {unit.highlights.map((feature) => (
                  <span
                    key={feature}
                    className="inline-flex items-center gap-1.5 rounded border border-line bg-cream px-2.5 py-1 text-xs text-ink/80"
                  >
                    <CheckCircle className="h-3.5 w-3.5 text-lagoon" />
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pied : prix + actions */}
        <div className="flex shrink-0 flex-col justify-between gap-4 border-t border-line bg-white p-4 sm:flex-row sm:items-center sm:p-5">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted">
              {MARKET_STUDY_MODE ? 'Prix indicatif' : 'Prix du bien'}
              {unit.statusLabel ? ` · ${unit.statusLabel}` : ''}
            </div>
            <div className="text-xl font-semibold text-laterite sm:text-2xl">
              {unit.priceFormatted}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {MARKET_STUDY_MODE ? (
              <>
                <button onClick={onClose} className="btn-outline !py-2.5 !text-xs">
                  Fermer
                </button>
                <a href={SURVEY_PATH} className="btn-primary !py-2.5 !text-xs">
                  <MessageCircle className="h-4 w-4" /> Donnez votre avis
                </a>
              </>
            ) : (
              <>
                <button
                  onClick={handleDownloadPdf}
                  className="btn-outline !py-2.5 !text-xs"
                >
                  <Download className="h-4 w-4" /> Plaquette PDF
                </button>

                <button
                  onClick={() => setShowOptionModal(true)}
                  disabled={!unit.canReserve}
                  className="btn-outline !py-2.5 !text-xs disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Clock className="h-4 w-4" /> Option 48h
                </button>

                <button
                  onClick={() => {
                    onClose();
                    onOpenReservation(unit.id);
                  }}
                  disabled={!unit.canReserve}
                  className="btn-primary !py-2.5 !text-xs disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {unit.statusLabel ? unit.statusLabel : 'Réserver en ligne'}{' '}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Option 48h — code de vente conservé, inaccessible en mode étude. */}
      {showOptionModal && !MARKET_STUDY_MODE && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md space-y-4 rounded-2xl border border-line bg-white p-6 shadow-2xl">
            <button
              onClick={() => setShowOptionModal(false)}
              className="absolute right-4 top-4 text-muted hover:text-ink"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-laterite/20 bg-laterite/10 p-2.5 text-laterite">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-serif text-lg font-semibold text-ink">Bloquer une option 48h</h4>
                <p className="text-xs text-muted">Sans engagement financier immédiat</p>
              </div>
            </div>

            {optionHeld ? (
              <div className="space-y-2 rounded-xl border border-lagoon/30 bg-lagoon/10 p-4 text-center">
                <CheckCircle className="mx-auto h-8 w-8 text-lagoon" />
                <p className="font-serif text-base font-semibold text-ink">
                  Option enregistrée pour 48 heures
                </p>
                <p className="text-xs text-muted">
                  Un conseiller commercial vous contactera pour valider les éléments du contrat.
                </p>
              </div>
            ) : (
              <form onSubmit={handleHoldOption} className="space-y-3 text-xs">
                <div>
                  <label className="mb-1 block text-muted">Nom & prénom</label>
                  <input
                    type="text"
                    required
                    placeholder="ex. Koffi Mensah"
                    className="w-full rounded-lg border border-line bg-cream p-2.5 text-ink placeholder:text-muted/60 focus:border-laterite focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-muted">Téléphone / WhatsApp</label>
                  <input
                    type="tel"
                    required
                    placeholder="ex. +228 90 12 34 56"
                    className="w-full rounded-lg border border-line bg-cream p-2.5 text-ink placeholder:text-muted/60 focus:border-laterite focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-muted">Adresse e-mail</label>
                  <input
                    type="email"
                    required
                    placeholder="ex. mensah@example.com"
                    className="w-full rounded-lg border border-line bg-cream p-2.5 text-ink placeholder:text-muted/60 focus:border-laterite focus:outline-none"
                  />
                </div>
                <button type="submit" className="btn-primary w-full !text-xs">
                  Confirmer mon option 48h
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {currentPhoto && (
        <ImageLightbox
          src={currentPhoto.url}
          alt={currentPhoto.altText}
          isOpen={photoLightboxOpen}
          onClose={() => setPhotoLightboxOpen(false)}
          gallery={photos.map((photo) => ({ src: photo.url, alt: photo.altText }))}
          initialIndex={safeIdx}
        />
      )}
    </div>
  );
}
