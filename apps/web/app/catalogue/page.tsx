'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import ReservationModal from '../../components/ReservationModal';
import ComplexOverviewViewer from '../../components/catalogue/ComplexOverviewViewer';
import Apartment3DModal from '../../components/catalogue/Apartment3DModal';
import CatalogueGrid from '../../components/catalogue/CatalogueGrid';
import { DEFAULT_COMPLEX_DATA, ComplexInfo } from '../../lib/catalogData';
import { fetchCatalogProjects, fetchTypologies, fetchUnit, CatalogProject, TypologyGroup } from '../../lib/api';
import { buildUnitDetailView, UnitDetailView } from '../../lib/catalog/unit-detail';
import {
  Building,
  ArrowRight,
  ShieldCheck,
  PhoneCall,
  Clock,
  Settings,
} from 'lucide-react';

export default function CataloguePage() {
  // Le fallback statique garantit un rendu initial stable lorsque l'API est indisponible.
  const [catalogData, setCatalogData] = useState<ComplexInfo>(DEFAULT_COMPLEX_DATA);
  const [groups, setGroups] = useState<TypologyGroup[]>([]);
  const [project, setProject] = useState<CatalogProject | null>(null);

  // Unité réelle ouverte dans la fiche 3D (source de vérité : GET /catalog/units/:id).
  const [selectedUnit, setSelectedUnit] = useState<UnitDetailView | null>(null);
  const [unitLoading, setUnitLoading] = useState(false);
  const [unitError, setUnitError] = useState<string | null>(null);
  const [is3DModalOpen, setIs3DModalOpen] = useState(false);

  // Réservation : unité réelle (cuid), plus jamais d'id factice.
  const [reservationUnitId, setReservationUnitId] = useState<string | null>(null);
  const [isReservationOpen, setIsReservationOpen] = useState(false);

  useEffect(() => {
    Promise.all([fetchCatalogProjects(), fetchTypologies()])
      .then(([projects, typologies]) => {
        const publishedProject = projects[0];
        if (!publishedProject) return;
        setProject(publishedProject);
        setGroups(typologies);
        const marketing = publishedProject.marketingInfo;
        setCatalogData((previous) => ({
          ...previous,
          name: marketing?.name ?? publishedProject.name,
          location: marketing?.location ?? publishedProject.location,
          titleDeed: marketing?.titleDeed ?? previous.titleDeed,
          totalLandArea: marketing?.totalLandArea ?? previous.totalLandArea,
          deliveryDate: marketing?.deliveryDate || previous.deliveryDate,
          notaryName: marketing?.notaryName || previous.notaryName,
          escrowBank: marketing?.escrowBank || previous.escrowBank,
          views: publishedProject.views ?? [],
        }));
      })
      .catch((e) => console.warn('[catalogue] données résidence indisponibles :', e));
  }, []);

  const openUnitDetail = (unitId: string) => {
    setSelectedUnit(null);
    setUnitError(null);
    setUnitLoading(true);
    fetchUnit(unitId)
      .then((unit) => setSelectedUnit(buildUnitDetailView(unit)))
      .catch((e) => setUnitError(e instanceof Error ? e.message : 'Impossible de charger l\'unité.'))
      .finally(() => setUnitLoading(false));
    setIs3DModalOpen(true);
  };

  const handleOpenReservation = (unitId: string) => {
    setReservationUnitId(unitId);
    setIsReservationOpen(true);
  };

  const blockTargets = project?.blocks.flatMap((block) => {
    const candidates = groups.flatMap((group) =>
      group.units.filter((unit) => unit.blockName === block.name),
    );
    const representative = candidates.find((unit) => unit.status === 'DISPONIBLE') ?? candidates[0];
    return representative ? [{ id: block.id, unitId: representative.id }] : [];
  }) ?? [];

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
                Explorez le complexe {catalogData.name} en 3D photoréaliste. Cliquez sur les blocs et appartements pour afficher les plans cotés, visuels 3D et l'échéancier de paiement.
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

      {/* Main Complex Interactive Overview Section — masqué tant qu'aucune vue réelle n'existe */}
      {project !== null && catalogData.views.length > 0 && (
      <section className="py-12 bg-ink border-b border-paper/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <ComplexOverviewViewer
            views={catalogData.views}
            units={catalogData.units}
            blockTargets={blockTargets}
            residenceInfo={catalogData}
            onSelectUnit={openUnitDetail}
          />
        </div>
      </section>
      )}

      {/* Catalog Filter & Unit Grid Section */}
      <section id="grille-biens" className="py-16 bg-ink-dark/50 border-b border-paper/10 scroll-mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <CatalogueGrid
            onOpenUnit={openUnitDetail}
            onOpenReservation={handleOpenReservation}
          />
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
        unit={selectedUnit}
        isOpen={is3DModalOpen}
        onClose={() => setIs3DModalOpen(false)}
        onOpenReservation={(unitId) => {
          setIs3DModalOpen(false);
          handleOpenReservation(unitId);
        }}
      />
      {unitError && is3DModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
          <div className="bg-ink-card border border-paper/30 rounded-lg max-w-md w-full p-8 text-center space-y-4">
            <p className="font-mono text-xs text-paper/80">{unitError}</p>
            <button
              onClick={() => setIs3DModalOpen(false)}
              className="bg-laterite hover:bg-laterite-light text-paper font-mono text-xs px-6 py-2.5 rounded transition-all"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Reservation Modal */}
      <ReservationModal
        isOpen={isReservationOpen}
        unitId={reservationUnitId}
        onClose={() => setIsReservationOpen(false)}
      />
    </main>
  );
}
