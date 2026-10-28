'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Building,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import MarketStudyBanner from '../../components/MarketStudyBanner';
import ReservationModal from '../../components/ReservationModal';
import ComplexOverviewViewer, {
  BlockTarget,
} from '../../components/catalogue/ComplexOverviewViewer';
import Apartment3DModal from '../../components/catalogue/Apartment3DModal';
import CatalogueGrid from '../../components/catalogue/CatalogueGrid';
import { DEFAULT_COMPLEX_DATA, ComplexInfo } from '../../lib/catalogData';
import { fetchCatalogProjects, fetchUnit, CatalogProject } from '../../lib/api';
import { buildUnitDetailView, UnitDetailView } from '../../lib/catalog/unit-detail';
import { buildBlockViewsMap } from '../../lib/catalog/overview-view';
import { MARKET_STUDY_MODE, SURVEY_PATH } from '../../lib/market-mode';

export default function CataloguePage() {
  // Fallback neutre : aucune vue, aucun prix, aucune unité inventée.
  const [catalogData, setCatalogData] = useState<ComplexInfo>(DEFAULT_COMPLEX_DATA);
  const [project, setProject] = useState<CatalogProject | null>(null);
  const [catalogError, setCatalogError] = useState(false);

  // Unité réelle ouverte dans la fiche 3D (source de vérité : GET /catalog/units/:id).
  const [selectedUnit, setSelectedUnit] = useState<UnitDetailView | null>(null);
  const [unitLoading, setUnitLoading] = useState(false);
  const [unitError, setUnitError] = useState<string | null>(null);
  const [is3DModalOpen, setIs3DModalOpen] = useState(false);

  // Réservation : unité réelle (cuid), plus jamais d'id factice.
  const [reservationUnitId, setReservationUnitId] = useState<string | null>(null);
  const [isReservationOpen, setIsReservationOpen] = useState(false);

  useEffect(() => {
    fetchCatalogProjects()
      .then((projects) => {
        const publishedProject = projects[0];
        if (!publishedProject) {
          setCatalogError(true);
          return;
        }
        setProject(publishedProject);
        const marketing = publishedProject.marketingInfo;
        setCatalogData((previous) => ({
          ...previous,
          name: marketing?.name ?? publishedProject.name,
          location: marketing?.location ?? publishedProject.location,
          // Le titre foncier n'est affiché qu'une fois validé par le notaire.
          titleDeed: MARKET_STUDY_MODE ? '' : (marketing?.titleDeed ?? ''),
          totalLandArea: marketing?.totalLandArea ?? previous.totalLandArea,
          deliveryDate: marketing?.deliveryDate || previous.deliveryDate,
          notaryName: marketing?.notaryName || previous.notaryName,
          escrowBank: marketing?.escrowBank || previous.escrowBank,
          views: publishedProject.views ?? [],
        }));
      })
      .catch((cause) => {
        console.warn('[catalogue] données résidence indisponibles :', cause);
        setCatalogError(true);
      });
  }, []);

  const openUnitDetail = (unitId: string) => {
    setSelectedUnit(null);
    setUnitError(null);
    setUnitLoading(true);
    fetchUnit(unitId)
      .then((unit) => setSelectedUnit(buildUnitDetailView(unit)))
      .catch((cause) => {
        console.warn('[catalogue] unité indisponible :', cause);
        setUnitError("La fiche de ce logement est momentanément indisponible.");
      })
      .finally(() => setUnitLoading(false));
    setIs3DModalOpen(true);
  };

  const handleOpenReservation = (unitId: string) => {
    setReservationUnitId(unitId);
    setIsReservationOpen(true);
  };

  const blockTargets: BlockTarget[] =
    project?.blocks.flatMap((block) => {
      const representative =
        block.units.find((unit) => unit.status === 'DISPONIBLE') ?? block.units[0];
      return representative
        ? [{ id: block.id, unitId: representative.id, name: block.name }]
        : [];
    }) ?? [];

  const units = project?.blocks.flatMap((block) => block.units.map((unit) => ({ id: unit.id }))) ?? [];
  const blockViewsMap = buildBlockViewsMap(project?.blocks ?? null);
  const hasOverview = project !== null && (catalogData.views.length > 0 || Object.keys(blockViewsMap).length > 0);

  return (
    <main className="min-h-screen bg-cream text-body">
      <Navbar />
      <MarketStudyBanner />

      <section className="border-b border-line bg-cream py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-3xl">
              <p className="eyebrow text-laterite">
                Catalogue 3D · Baguida, Lomé
              </p>
              <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight text-ink sm:text-5xl">
                Le projet, <em className="italic text-laterite">logement par logement</em>
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
                Explorez les vues du complexe et ouvrez chaque logement pour
                consulter les plans et les visuels disponibles.
                {MARKET_STUDY_MODE && ' Les prix et les plans sont indicatifs : le projet est à l’étude.'}
              </p>
            </div>

            <a href="#grille-biens" className="btn-primary shrink-0">
              Voir la grille des biens <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {catalogError && (
        <section className="border-b border-line bg-cream py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="card flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ink">
                Les informations de la résidence sont momentanément indisponibles.
                La grille des logements reste accessible.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="btn-outline !py-2.5 !text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Réessayer
              </button>
            </div>
          </div>
        </section>
      )}

      {hasOverview && (
        <section className="border-b border-line bg-cream py-10 sm:py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <ComplexOverviewViewer
              views={catalogData.views}
              units={units}
              blockTargets={blockTargets}
              blockViewsMap={blockViewsMap}
              residenceInfo={catalogData}
              onSelectUnit={openUnitDetail}
            />
          </div>
        </section>
      )}

      <section id="grille-biens" className="scroll-mt-24 border-b border-line bg-cream py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <CatalogueGrid
            onOpenUnit={openUnitDetail}
            onOpenReservation={handleOpenReservation}
          />
        </div>
      </section>

      <section className="bg-cream-dim py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {MARKET_STUDY_MODE ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="card p-5">
                <Sparkles className="h-5 w-5 text-laterite" />
                <h2 className="mt-3 font-serif text-lg font-semibold text-ink">
                  Prix et plans indicatifs
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Ils seront confirmés avant toute commercialisation, à partir
                  des réponses au questionnaire.
                </p>
              </div>
              <div className="card p-5">
                <ShieldCheck className="h-5 w-5 text-laterite" />
                <h2 className="mt-3 font-serif text-lg font-semibold text-ink">
                  Aucune vente en cours
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Aucun paiement n’est accepté. Le projet est en phase d’étude
                  de marché.
                </p>
              </div>
              <div className="card p-5">
                <MessageCircle className="h-5 w-5 text-laterite" />
                <h2 className="mt-3 font-serif text-lg font-semibold text-ink">
                  Votre avis compte
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Deux minutes pour orienter les typologies, les prix et les
                  plans.
                </p>
                <a href={SURVEY_PATH} className="btn-primary mt-4 w-full !py-2.5 !text-xs">
                  Donnez votre avis
                </a>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {catalogData.titleDeed && (
                <div className="card p-5">
                  <ShieldCheck className="h-5 w-5 text-laterite" />
                  <h2 className="mt-3 font-serif text-lg font-semibold text-ink">
                    Titre foncier n° {catalogData.titleDeed}
                  </h2>
                  <p className="mt-2 text-sm text-muted">
                    Terrain purgé de tous droits de mutation, extrait disponible sur demande.
                  </p>
                </div>
              )}
              {catalogData.notaryName && catalogData.escrowBank && (
                <div className="card p-5">
                  <Building className="h-5 w-5 text-laterite" />
                  <h2 className="mt-3 font-serif text-lg font-semibold text-ink">
                    Compte séquestre notarié
                  </h2>
                  <p className="mt-2 text-sm text-muted">
                    {catalogData.notaryName} · {catalogData.escrowBank}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <Footer />

      <Apartment3DModal
        unit={selectedUnit}
        isOpen={is3DModalOpen}
        onClose={() => setIs3DModalOpen(false)}
        onOpenReservation={(unitId) => {
          setIs3DModalOpen(false);
          handleOpenReservation(unitId);
        }}
      />

      {unitLoading && is3DModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
          <div className="card max-w-sm p-8 text-center">
            <p className="text-sm text-muted">Chargement de la fiche…</p>
          </div>
        </div>
      )}

      {unitError && is3DModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
          <div className="card max-w-md p-8 text-center">
            <p className="text-sm text-ink">{unitError}</p>
            <button
              onClick={() => setIs3DModalOpen(false)}
              className="btn-outline mt-5 !py-2.5 !text-xs"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Le module de réservation reste dans le code ; il n'est monté qu'en mode vente. */}
      {!MARKET_STUDY_MODE && (
        <ReservationModal
          isOpen={isReservationOpen}
          unitId={reservationUnitId}
          onClose={() => setIsReservationOpen(false)}
        />
      )}
    </main>
  );
}
