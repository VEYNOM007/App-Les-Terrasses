'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import ReservationModal from '../../components/ReservationModal';
import ComplexOverviewViewer from '../../components/catalogue/ComplexOverviewViewer';
import Apartment3DModal from '../../components/catalogue/Apartment3DModal';
import { getCatalogData, ComplexInfo, Unit3DDetails } from '../../lib/catalogData';
import { UnitTypology } from '../../components/CatalogGrid';
import {
  Building,
  Sparkles,
  Filter,
  Eye,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  PhoneCall,
  MapPin,
  Download,
  Clock,
  Layers,
  Settings
} from 'lucide-react';

export default function CataloguePage() {
  const [catalogData, setCatalogData] = useState<ComplexInfo>(getCatalogData());
  const [selectedUnitFor3D, setSelectedUnitFor3D] = useState<Unit3DDetails | null>(null);
  const [is3DModalOpen, setIs3DModalOpen] = useState<boolean>(false);

  // Reservation Modal state
  const [isReservationOpen, setIsReservationOpen] = useState<boolean>(false);
  const [reservationTypology, setReservationTypology] = useState<UnitTypology | null>(null);

  // Filters state
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterMaxPrice, setFilterMaxPrice] = useState<number>(100000000);

  useEffect(() => {
    setCatalogData(getCatalogData());
  }, []);

  const handleOpen3D = (unit: Unit3DDetails) => {
    setSelectedUnitFor3D(unit);
    setIs3DModalOpen(true);
  };

  const handleOpenReservationFromUnit = (unit: Unit3DDetails) => {
    const convertedTypology: UnitTypology = {
      id: unit.id,
      name: unit.name,
      type: unit.type,
      surface: `${unit.surfaceTotaleM2} m²`,
      description: unit.description,
      features: unit.keyFeatures,
      startingPrice: unit.startingPriceFormatted,
      availableCount: unit.availableUnitsCount,
      badge: unit.badge,
    };
    setReservationTypology(convertedTypology);
    setIsReservationOpen(true);
  };

  // Filtered units
  const filteredUnits = catalogData.units.filter((unit) => {
    if (filterType !== 'ALL' && unit.type !== filterType) return false;
    if (unit.startingPriceXOF > filterMaxPrice) return false;
    return true;
  });

  return (
    <main className="min-h-screen bg-ink text-paper selection:bg-laterite selection:text-paper font-sans">
      {/* Top Navbar */}
      <Navbar />

      {/* Hero Banner Section */}
      <section className="relative pt-12 pb-16 bg-gradient-to-b from-ink via-ink-card to-ink overflow-hidden border-b border-paper/10">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-laterite/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div className="space-y-4 max-w-3xl">
              <div className="inline-flex items-center gap-2 text-xs font-mono text-sand uppercase tracking-widest">
                <span className="w-5 h-[1px] bg-laterite-light inline-block" />
                Catalogue Officiel VEFA 3D · Lomé - Baguida
              </div>

              <h1 className="font-serif text-3xl sm:text-5xl font-semibold text-paper leading-tight">
                Catalogue Général & <em className="italic text-laterite-light">Vues du Complexe</em>
              </h1>

              <p className="text-sm sm:text-base text-paper/80 leading-relaxed">
                Explorez le complexe {catalogData.name} en 3D photoréaliste. Cliquez sur les blocs et appartements pour afficher les plans cotés, finitions personnalisables et descriptifs techniques VEFA.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href="/admin/catalogue"
                className="bg-paper/10 hover:bg-paper/20 border border-paper/20 text-paper font-mono text-xs px-4 py-3 rounded-lg inline-flex items-center gap-2 transition-all"
              >
                <Settings className="w-4 h-4 text-sand" /> Espace Promoteur (Sans-Code)
              </a>
              <a
                href="#grille-biens"
                className="bg-laterite hover:bg-laterite-light text-paper font-mono text-xs px-5 py-3 rounded-lg inline-flex items-center gap-2 transition-all shadow-lg"
              >
                Voir la grille des biens <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Main Complex Interactive Overview Section */}
      <section className="py-12 bg-ink border-b border-paper/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <ComplexOverviewViewer
            views={catalogData.views}
            units={catalogData.units}
            onSelectUnit={handleOpen3D}
          />
        </div>
      </section>

      {/* Catalog Filter & Unit Grid Section */}
      <section id="grille-biens" className="py-16 bg-ink-dark/50 border-b border-paper/10 scroll-mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-paper/15">
            <div>
              <span className="text-xs font-mono text-sand uppercase">Vente en l'État Futur d'Achèvement (VEFA)</span>
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-paper">
                Découvrez les Typologies Disponibles
              </h2>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              <button
                onClick={() => setFilterType('ALL')}
                className={`px-3 py-2 rounded-lg border transition-all ${
                  filterType === 'ALL'
                    ? 'bg-laterite text-paper border-laterite font-bold'
                    : 'bg-ink border-paper/15 text-paper/70 hover:border-paper/40'
                }`}
              >
                Tous ({catalogData.units.length})
              </button>
              <button
                onClick={() => setFilterType('STUDIO')}
                className={`px-3 py-2 rounded-lg border transition-all ${
                  filterType === 'STUDIO'
                    ? 'bg-laterite text-paper border-laterite font-bold'
                    : 'bg-ink border-paper/15 text-paper/70 hover:border-paper/40'
                }`}
              >
                Studios
              </button>
              <button
                onClick={() => setFilterType('T2')}
                className={`px-3 py-2 rounded-lg border transition-all ${
                  filterType === 'T2'
                    ? 'bg-laterite text-paper border-laterite font-bold'
                    : 'bg-ink border-paper/15 text-paper/70 hover:border-paper/40'
                }`}
              >
                T2
              </button>
              <button
                onClick={() => setFilterType('T3')}
                className={`px-3 py-2 rounded-lg border transition-all ${
                  filterType === 'T3'
                    ? 'bg-laterite text-paper border-laterite font-bold'
                    : 'bg-ink border-paper/15 text-paper/70 hover:border-paper/40'
                }`}
              >
                T3
              </button>
              <button
                onClick={() => setFilterType('T5')}
                className={`px-3 py-2 rounded-lg border transition-all ${
                  filterType === 'T5'
                    ? 'bg-laterite text-paper border-laterite font-bold'
                    : 'bg-ink border-paper/15 text-paper/70 hover:border-paper/40'
                }`}
              >
                T5 Penthouse
              </button>
              <button
                onClick={() => setFilterType('COMMERCE')}
                className={`px-3 py-2 rounded-lg border transition-all ${
                  filterType === 'COMMERCE'
                    ? 'bg-laterite text-paper border-laterite font-bold'
                    : 'bg-ink border-paper/15 text-paper/70 hover:border-paper/40'
                }`}
              >
                Commerces
              </button>
            </div>
          </div>

          {/* Unit Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUnits.map((item) => (
              <div
                key={item.id}
                className="bg-ink-card border border-paper/20 rounded-xl overflow-hidden hover:border-sand transition-all flex flex-col justify-between group relative shadow-xl"
              >
                {item.badge && (
                  <span className="absolute top-4 right-4 z-10 text-[10px] font-mono bg-laterite/80 backdrop-blur-md text-paper border border-paper/30 px-2.5 py-1 rounded-md shadow-md">
                    {item.badge}
                  </span>
                )}

                <div>
                  {/* Photo thumbnail */}
                  <div
                    onClick={() => handleOpen3D(item)}
                    className="relative h-52 bg-ink-dark cursor-pointer overflow-hidden group/img"
                  >
                    <img
                      src={item.renderPhotos[0]?.url || item.floorPlan2DUrl}
                      alt={item.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent opacity-80" />

                    <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                      <span className="inline-flex items-center gap-1 bg-ink/90 backdrop-blur-md border border-paper/20 px-2.5 py-1 rounded text-[11px] font-mono text-sand">
                        <Eye className="w-3.5 h-3.5" /> Explorer en 3D
                      </span>
                      <span className="text-[11px] font-mono bg-lagoon/20 text-lagoon-light border border-lagoon/40 px-2 py-0.5 rounded">
                        {item.availableUnitsCount} dispo / {item.totalUnitsCount}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    <div>
                      <div className="text-[11px] font-mono text-sand uppercase mb-1">{item.blockName}</div>
                      <h3 className="font-serif text-xl font-semibold text-paper">{item.name}</h3>
                      <div className="text-xs font-mono text-paper/60 mt-1">
                        Surface utile : <strong className="text-paper">{item.surfaceTotaleM2} m²</strong> ({item.surfaceHabitableM2}m² hab + {item.surfaceTerrasseM2}m² terr.)
                      </div>
                    </div>

                    <p className="text-xs text-paper/70 leading-relaxed line-clamp-2">
                      {item.description}
                    </p>

                    <ul className="space-y-1.5 pt-3 border-t border-paper/10 text-xs font-mono text-paper/80">
                      {item.keyFeatures.slice(0, 3).map((feat, fIdx) => (
                        <li key={fIdx} className="flex items-center gap-2">
                          <CheckCircle className="w-3.5 h-3.5 text-lagoon-light shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="p-5 pt-0 border-t border-paper/15 mt-4 space-y-3">
                  <div className="flex justify-between items-baseline pt-3">
                    <span className="text-[10px] font-mono text-paper/50 uppercase">À PARTIR DE</span>
                    <span className="font-mono text-base text-laterite-light font-bold">
                      {item.startingPriceFormatted}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleOpen3D(item)}
                      className="bg-paper/10 hover:bg-paper/20 text-paper font-mono text-xs py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5 text-sand" /> Vue 3D & Plans
                    </button>
                    <button
                      onClick={() => handleOpenReservationFromUnit(item)}
                      className="bg-laterite hover:bg-laterite-light text-paper font-mono text-xs font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-md"
                    >
                      Réserver →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust & Legal Reassurance Banner */}
      <section className="py-12 bg-ink border-b border-paper/10 font-mono text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-ink-card p-4 rounded-xl border border-paper/15 flex items-start gap-3">
            <ShieldCheck className="w-6 h-6 text-sand shrink-0 mt-0.5" />
            <div>
              <h4 className="font-serif text-sm text-paper font-semibold mb-1">Titre Foncier N° RM 100/71</h4>
              <p className="text-paper/60 text-[11px]">Terrain purgé de tous droits de mutation, extrait disponible sur demande.</p>
            </div>
          </div>
          <div className="bg-ink-card p-4 rounded-xl border border-paper/15 flex items-start gap-3">
            <Building className="w-6 h-6 text-laterite-light shrink-0 mt-0.5" />
            <div>
              <h4 className="font-serif text-sm text-paper font-semibold mb-1">Compte Séquestre Notarié</h4>
              <p className="text-paper/60 text-[11px]">Étude Maître K. Lawson & Associés. Vos fonds sont sécurisés jusqu'aux étapes certifiées.</p>
            </div>
          </div>
          <div className="bg-ink-card p-4 rounded-xl border border-paper/15 flex items-start gap-3">
            <Clock className="w-6 h-6 text-lagoon-light shrink-0 mt-0.5" />
            <div>
              <h4 className="font-serif text-sm text-paper font-semibold mb-1">Paiement Échelonné Sans Frais</h4>
              <p className="text-paper/60 text-[11px]">Apport de départ puis versements calqués sur le calendrier de chantier.</p>
            </div>
          </div>
          <div className="bg-ink-card p-4 rounded-xl border border-paper/15 flex items-start gap-3">
            <PhoneCall className="w-6 h-6 text-sand shrink-0 mt-0.5" />
            <div>
              <h4 className="font-serif text-sm text-paper font-semibold mb-1">Service Client & Diaspora</h4>
              <p className="text-paper/60 text-[11px]">Accompagnement personnalisé à distance avec suivi vidéo régulier des travaux.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />

      {/* 3D & VEFA Details Modal */}
      <Apartment3DModal
        unit={selectedUnitFor3D}
        isOpen={is3DModalOpen}
        onClose={() => setIs3DModalOpen(false)}
        onOpenReservation={handleOpenReservationFromUnit}
      />

      {/* Reservation Modal */}
      <ReservationModal
        isOpen={isReservationOpen}
        onClose={() => setIsReservationOpen(false)}
        selectedTypology={reservationTypology}
      />
    </main>
  );
}
