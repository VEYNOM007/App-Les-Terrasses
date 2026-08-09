'use client';

import React, { useState } from 'react';
import { Unit3DDetails, UnitFinishingOption } from '../../lib/catalogData';
import FinancialSimulator from './FinancialSimulator';
import {
  X,
  Building,
  Maximize2,
  CheckCircle,
  Download,
  Calendar,
  PhoneCall,
  MessageSquare,
  Shield,
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Clock,
  ArrowRight
} from 'lucide-react';

interface Apartment3DModalProps {
  unit: Unit3DDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenReservation: (unit: Unit3DDetails) => void;
}

export default function Apartment3DModal({
  unit,
  isOpen,
  onClose,
  onOpenReservation
}: Apartment3DModalProps) {
  const [activePhotoIdx, setActivePhotoIdx] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'3d' | 'plan' | 'finitions' | 'specs' | 'finance'>('3d');
  const [selectedFinishes, setSelectedFinishes] = useState<Record<string, UnitFinishingOption>>({});
  const [showOptionModal, setShowOptionModal] = useState<boolean>(false);
  const [optionHeld, setOptionHeld] = useState<boolean>(false);

  if (!isOpen || !unit) return null;

  const currentPhoto = unit.renderPhotos[activePhotoIdx] || unit.renderPhotos[0];

  // Calculate extra cost from options
  const extraOptionsCost = Object.values(selectedFinishes).reduce((sum, opt) => sum + opt.priceDeltaXOF, 0);
  const totalPriceWithFinishes = unit.startingPriceXOF + extraOptionsCost;

  const handleSelectFinishingOption = (option: UnitFinishingOption) => {
    setSelectedFinishes((prev) => ({
      ...prev,
      [option.category]: option,
    }));
  };

  const formatPrice = (val: number) => {
    return new Intl.NumberFormat('fr-FR').format(val) + ' FCFA';
  };

  const handleDownloadPdf = () => {
    alert(`Téléchargement de la Plaquette Commerciale PDF & Fiche Technique : ${unit.name}`);
  };

  const handleHoldOption = (e: React.FormEvent) => {
    e.preventDefault();
    setOptionHeld(true);
    setTimeout(() => {
      setShowOptionModal(false);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink-dark/95 backdrop-blur-xl flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-ink border border-paper/20 rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl relative">
        {/* Modal Header */}
        <div className="bg-ink/90 border-b border-paper/15 p-4 sm:p-5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-laterite/20 border border-laterite/40 text-laterite-light flex items-center justify-center font-bold">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-sand uppercase tracking-wider">{unit.blockName}</span>
                {unit.badge && (
                  <span className="text-[10px] font-mono bg-laterite/20 text-laterite-light border border-laterite/40 px-2 py-0.5 rounded">
                    {unit.badge}
                  </span>
                )}
              </div>
              <h3 className="font-serif text-xl sm:text-2xl font-semibold text-paper">{unit.name}</h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-ink-card hover:bg-paper/10 text-paper/70 hover:text-paper transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-ink-dark border-b border-paper/15 px-4 sm:px-6 py-2 flex flex-wrap gap-2 text-xs font-mono shrink-0">
          <button
            onClick={() => setActiveTab('3d')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === '3d'
                ? 'bg-laterite text-paper font-bold shadow-md'
                : 'text-paper/70 hover:text-paper hover:bg-paper/10'
            }`}
          >
            <Sparkles className="w-4 h-4 text-sand" /> Vue & Photo 3D ({unit.renderPhotos.length})
          </button>
          <button
            onClick={() => setActiveTab('plan')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'plan'
                ? 'bg-laterite text-paper font-bold shadow-md'
                : 'text-paper/70 hover:text-paper hover:bg-paper/10'
            }`}
          >
            <Maximize2 className="w-4 h-4" /> Plan Coté (2D/3D)
          </button>
          <button
            onClick={() => setActiveTab('finitions')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'finitions'
                ? 'bg-laterite text-paper font-bold shadow-md'
                : 'text-paper/70 hover:text-paper hover:bg-paper/10'
            }`}
          >
            <Layers className="w-4 h-4" /> Configurateur Finitions
          </button>
          <button
            onClick={() => setActiveTab('specs')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'specs'
                ? 'bg-laterite text-paper font-bold shadow-md'
                : 'text-paper/70 hover:text-paper hover:bg-paper/10'
            }`}
          >
            <Shield className="w-4 h-4" /> Descriptif Technique VEFA
          </button>
          <button
            onClick={() => setActiveTab('finance')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'finance'
                ? 'bg-laterite text-paper font-bold shadow-md'
                : 'text-paper/70 hover:text-paper hover:bg-paper/10'
            }`}
          >
            <Calendar className="w-4 h-4 text-lagoon-light" /> Échéancier & Rentabilité
          </button>
        </div>

        {/* Modal Main Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* TAB 1: 3D PHOTO & RENDER GALLERY */}
          {activeTab === '3d' && (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-ink-dark border border-paper/15 aspect-video flex items-center justify-center group shadow-xl">
                <img
                  src={currentPhoto.url}
                  alt={currentPhoto.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-transparent to-transparent pointer-events-none" />

                {/* Photo Caption & Angle Tag */}
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center bg-ink/80 backdrop-blur-md border border-paper/20 p-3 rounded-lg">
                  <div>
                    <span className="text-[10px] font-mono uppercase bg-laterite/30 text-sand px-2 py-0.5 rounded border border-laterite/40">
                      Rendu 3D VEFA · Angle {currentPhoto.angle}
                    </span>
                    <h4 className="font-serif text-sm font-semibold text-paper mt-1">{currentPhoto.title}</h4>
                  </div>
                  <span className="text-xs font-mono text-paper/60">
                    {activePhotoIdx + 1} / {unit.renderPhotos.length}
                  </span>
                </div>

                {/* Left/Right Carousel Controls */}
                {unit.renderPhotos.length > 1 && (
                  <>
                    <button
                      onClick={() =>
                        setActivePhotoIdx((prev) => (prev === 0 ? unit.renderPhotos.length - 1 : prev - 1))
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-ink/80 hover:bg-laterite text-paper transition-all"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() =>
                        setActivePhotoIdx((prev) => (prev === unit.renderPhotos.length - 1 ? 0 : prev + 1))
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-ink/80 hover:bg-laterite text-paper transition-all"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>

              {/* Thumbnails row */}
              <div className="flex gap-3 overflow-x-auto pb-2">
                {unit.renderPhotos.map((photo, pIdx) => (
                  <button
                    key={pIdx}
                    onClick={() => setActivePhotoIdx(pIdx)}
                    className={`relative w-24 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                      activePhotoIdx === pIdx ? 'border-laterite scale-105' : 'border-paper/20 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={photo.url} alt={photo.title} className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 right-1 text-[9px] font-mono bg-ink/80 px-1 rounded text-paper">
                      {photo.angle}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: FLOOR PLAN 2D/3D */}
          {activeTab === 'plan' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              <div className="md:col-span-8 bg-ink-dark border border-paper/15 rounded-xl p-4 flex flex-col items-center">
                <span className="text-xs font-mono text-sand mb-2 uppercase">Plan d'Architecture Coté · Échelle 1/50</span>
                <img
                  src={unit.floorPlan2DUrl}
                  alt="Plan d'architecture"
                  className="w-full max-h-[400px] object-contain rounded-lg border border-paper/10"
                />
              </div>

              <div className="md:col-span-4 space-y-4 font-mono text-xs">
                <div className="bg-ink-card border border-paper/15 p-4 rounded-xl space-y-3">
                  <h4 className="font-serif text-sm font-semibold text-paper">Surfaces & Hauteurs</h4>

                  <div className="space-y-2 border-t border-paper/10 pt-3">
                    <div className="flex justify-between">
                      <span className="text-paper/60">Surface Habitable</span>
                      <span className="font-bold text-paper">{unit.surfaceHabitableM2} m²</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-paper/60">Terrasse / Balcon</span>
                      <span className="font-bold text-sand">{unit.surfaceTerrasseM2} m²</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-paper/10 font-bold">
                      <span className="text-paper">Surface Utile Totale</span>
                      <span className="text-laterite-light text-sm">{unit.surfaceTotaleM2} m²</span>
                    </div>
                    <div className="flex justify-between pt-2">
                      <span className="text-paper/60">Hauteur sous plafond</span>
                      <span className="font-bold text-paper">{unit.ceilingHeightM} m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-paper/60">Orientation</span>
                      <span className="font-bold text-lagoon-light">{unit.orientation}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FINISHING CONFIGURATOR */}
          {activeTab === 'finitions' && (
            <div className="space-y-6 font-sans">
              <div className="bg-ink-card border border-paper/15 p-4 rounded-xl">
                <h4 className="font-serif text-base font-semibold text-paper mb-1">
                  Personnalisez vos matériaux & options de finitions
                </h4>
                <p className="text-xs font-mono text-paper/70">
                  Sélectionnez vos finitions pour générer votre devis sur-mesure avant réservation.
                </p>
              </div>

              {unit.finishingOptions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {unit.finishingOptions.map((opt) => {
                    const isSelected = selectedFinishes[opt.category]?.id === opt.id || (opt.isDefault && !selectedFinishes[opt.category]);
                    return (
                      <div
                        key={opt.id}
                        onClick={() => handleSelectFinishingOption(opt)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-laterite/15 border-laterite text-paper shadow-lg'
                            : 'bg-ink-card border-paper/15 text-paper/80 hover:border-sand'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            {opt.previewColor && (
                              <span
                                className="w-5 h-5 rounded-full border border-paper/30 shadow-sm"
                                style={{ backgroundColor: opt.previewColor }}
                              />
                            )}
                            <span className="font-serif text-sm font-semibold text-paper">{opt.name}</span>
                          </div>
                          {isSelected && <CheckCircle className="w-5 h-5 text-laterite-light shrink-0" />}
                        </div>

                        <p className="text-xs text-paper/70 mb-3">{opt.description}</p>

                        <div className="pt-2 border-t border-paper/10 flex justify-between items-center font-mono text-xs">
                          <span className="text-paper/50 uppercase text-[10px]">Supplément</span>
                          <span className={opt.priceDeltaXOF > 0 ? 'text-laterite-light font-bold' : 'text-lagoon-light font-bold'}>
                            {opt.priceDeltaXOF === 0 ? 'Inclus (Inclus)' : `+ ${formatPrice(opt.priceDeltaXOF)}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center bg-ink-card rounded-xl border border-paper/10 text-paper/60 font-mono text-xs">
                  Aucune option supplémentaire requise pour cette typologie.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: TECHNICAL SPECS SHEET */}
          {activeTab === 'specs' && (
            <div className="space-y-6 font-sans">
              <div className="bg-ink-card border border-paper/15 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-serif text-base font-semibold text-paper">Notice Descriptive Technique VEFA</h4>
                  <p className="text-xs font-mono text-paper/60">Spécifications garanties au contrat de réservation</p>
                </div>
                <button
                  onClick={handleDownloadPdf}
                  className="bg-paper/10 hover:bg-paper/20 border border-paper/20 text-paper px-3.5 py-2 rounded-lg text-xs font-mono flex items-center gap-2 transition-all"
                >
                  <Download className="w-4 h-4 text-sand" /> Télécharger PDF
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {unit.technicalSpecs.map((spec, sIdx) => (
                  <div key={sIdx} className="bg-ink-card border border-paper/15 p-4 rounded-xl space-y-3">
                    <h5 className="font-serif text-sm font-semibold text-sand pb-2 border-b border-paper/15">
                      {spec.category}
                    </h5>
                    <ul className="space-y-2 font-mono text-xs text-paper/80">
                      {spec.items.map((item, iIdx) => (
                        <li key={iIdx} className="space-y-0.5">
                          <span className="text-paper/50 block text-[10px] uppercase">{item.label}</span>
                          <span className="text-paper font-sans text-xs block">{item.detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: FINANCIAL SIMULATOR */}
          {activeTab === 'finance' && (
            <FinancialSimulator
              unitPriceXOF={totalPriceWithFinishes}
              estimatedMonthlyRentXOF={unit.estimatedMonthlyRentXOF}
              estimatedNetYieldAnnual={unit.estimatedNetYieldAnnual}
            />
          )}

          {/* Description & Key Features overview bar */}
          <div className="bg-ink-card border border-paper/15 p-4 rounded-xl space-y-3">
            <p className="text-xs sm:text-sm text-paper/80 leading-relaxed">{unit.description}</p>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-paper/10">
              {unit.keyFeatures.map((feat, fIdx) => (
                <span
                  key={fIdx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-paper/5 border border-paper/15 text-xs font-mono text-paper/80"
                >
                  <CheckCircle className="w-3.5 h-3.5 text-lagoon-light" />
                  {feat}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer / Price & Call to Actions */}
        <div className="bg-ink/95 border-t border-paper/15 p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 shrink-0">
          <div>
            <div className="text-[11px] font-mono text-paper/50 uppercase">
              PRIX DU BIEN {extraOptionsCost > 0 ? '(FINITIONS INCLUSES)' : ''}
            </div>
            <div className="font-mono text-xl sm:text-2xl font-bold text-laterite-light">
              {formatPrice(totalPriceWithFinishes)}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Download PDF brochure button */}
            <button
              onClick={handleDownloadPdf}
              className="border border-paper/20 hover:border-sand hover:bg-paper/5 text-paper px-4 py-3 rounded-lg text-xs font-mono flex items-center justify-center gap-2 transition-all"
            >
              <Download className="w-4 h-4 text-sand" /> Plaquette PDF
            </button>

            {/* Hold Option 48h button */}
            <button
              onClick={() => setShowOptionModal(true)}
              className="border border-laterite/40 bg-laterite/10 hover:bg-laterite/20 text-laterite-light px-4 py-3 rounded-lg text-xs font-mono flex items-center justify-center gap-2 transition-all"
            >
              <Clock className="w-4 h-4" /> Option Prioritaire 48h
            </button>

            {/* Direct WhatsApp button */}
            <a
              href={`https://wa.me/22890000000?text=Bonjour,%20je%20suis%20intéressé(e)%20par%20le%20${encodeURIComponent(unit.name)}%20à%20Baguida.`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-lagoon hover:bg-lagoon-light text-paper px-4 py-3 rounded-lg text-xs font-mono flex items-center justify-center gap-2 transition-all shadow-lg"
            >
              <MessageSquare className="w-4 h-4" /> WhatsApp Promoteur
            </a>

            {/* Reserve CTA */}
            <button
              onClick={() => {
                onClose();
                onOpenReservation(unit);
              }}
              className="bg-laterite hover:bg-laterite-light text-paper font-bold px-6 py-3 rounded-lg text-xs font-mono flex items-center justify-center gap-2 transition-all shadow-lg hover:scale-105"
            >
              Réserver en ligne <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Option Hold 48h Modal */}
      {showOptionModal && (
        <div className="fixed inset-0 z-60 bg-ink-dark/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-ink border border-paper/30 p-6 rounded-2xl max-w-md w-full space-y-4 relative shadow-2xl">
            <button
              onClick={() => setShowOptionModal(false)}
              className="absolute top-4 right-4 text-paper/50 hover:text-paper"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-sand/20 text-sand border border-sand/30">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-serif text-lg font-semibold text-paper">Bloquer une Option 48h</h4>
                <p className="text-xs font-mono text-paper/60">Sans engagement financier immédiat</p>
              </div>
            </div>

            {optionHeld ? (
              <div className="p-4 rounded-xl bg-lagoon/20 border border-lagoon/40 text-center space-y-2">
                <CheckCircle className="w-8 h-8 text-lagoon-light mx-auto" />
                <p className="font-serif text-base text-paper font-semibold">Option enregistrée pour 48 heures !</p>
                <p className="text-xs font-mono text-paper/70">
                  Un conseiller commercial va vous contacter par téléphone / WhatsApp pour valider les éléments du contrat.
                </p>
              </div>
            ) : (
              <form onSubmit={handleHoldOption} className="space-y-3 font-mono text-xs">
                <div>
                  <label className="block text-paper/70 mb-1">Nom & Prénom</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Koffi Mensah"
                    className="w-full bg-ink-card border border-paper/20 rounded-lg p-2.5 text-paper placeholder-paper/40 focus:border-sand outline-none"
                  />
                </div>
                <div>
                  <label className="block text-paper/70 mb-1">Numéro Téléphone / WhatsApp</label>
                  <input
                    type="tel"
                    required
                    placeholder="ex: +228 90 12 34 56"
                    className="w-full bg-ink-card border border-paper/20 rounded-lg p-2.5 text-paper placeholder-paper/40 focus:border-sand outline-none"
                  />
                </div>
                <div>
                  <label className="block text-paper/70 mb-1">Adresse Email</label>
                  <input
                    type="email"
                    required
                    placeholder="ex: mensah@gmail.com"
                    className="w-full bg-ink-card border border-paper/20 rounded-lg p-2.5 text-paper placeholder-paper/40 focus:border-sand outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-laterite hover:bg-laterite-light text-paper font-bold py-3 rounded-lg transition-all"
                >
                  Confirmer mon Option Bloquée 48h
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
