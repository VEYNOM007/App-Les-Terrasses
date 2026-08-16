'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import { DEFAULT_COMPLEX_DATA, ComplexInfo, ComplexView } from '../../../lib/catalogData';
import {
  adminAddUnitMedia,
  adminCreateUnit,
  adminDeleteMedia,
  adminDeleteUnit,
  adminUpdateProject,
  adminUpdateMedia,
  adminUpdateUnit,
  fetchAdminProjects,
  uploadUnitMedia,
  CatalogUnit,
  UnitMedia,
  UnitMediaType,
  UnitStatus,
  UnitType,
  AdminProject,
} from '../../../lib/api';
import {
  Save,
  Plus,
  Trash2,
  Edit,
  Eye,
  Building,
  CheckCircle,
  Sparkles,
  RefreshCw,
  ArrowLeft,
  Image,
  DollarSign,
  Layers,
  MapPin,
  Loader2,
  AlertCircle,
  Database
} from 'lucide-react';

/**
 * Aplatit l'écran admin (projets → blocs → unités, tous statuts dont ARCHIVE)
 * vers la forme CatalogUnit utilisée par le tableau du panneau.
 */
function flattenAdminUnits(projects: AdminProject[]): CatalogUnit[] {
  const result: CatalogUnit[] = [];
  for (const project of projects) {
    for (const block of project.blocks) {
      for (const u of block.units) {
        result.push({
          id: u.id,
          type: u.type,
          surface: u.surface,
          floor: u.floor,
          price: u.price,
          status: u.status,
          currency: u.currency,
          planImage: u.planImage,
          virtualTourUrl: u.virtualTourUrl,
          marketingDescription: u.marketingDescription,
          highlights: u.highlights,
          block: { name: block.name, frontage: block.frontage },
          media: u.media,
        });
      }
    }
  }
  return result;
}

export default function AdminCataloguePage() {
  const [data, setData] = useState<ComplexInfo | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [editingView, setEditingView] = useState<ComplexView | null>(null);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    setData(DEFAULT_COMPLEX_DATA);
  }, []);

  // ── Section « Unités de la base (API) » — persistance réelle ──
  const [units, setUnits] = useState<CatalogUnit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [unitsError, setUnitsError] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState<string>('');
  const [statusInput, setStatusInput] = useState<UnitStatus>('DISPONIBLE');
  const [savingUnit, setSavingUnit] = useState(false);
  const [unitActionError, setUnitActionError] = useState('');
  const [unitActionSuccess, setUnitActionSuccess] = useState('');
  const [mediaTypeInput, setMediaTypeInput] = useState<UnitMediaType>('RENDU_3D');
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [mediaFileInput, setMediaFileInput] = useState<File | null>(null);
  const [savingMedia, setSavingMedia] = useState(false);
  const [mediaActionError, setMediaActionError] = useState('');
  const [mediaActionSuccess, setMediaActionSuccess] = useState('');

  // Formulaire d'ajout d'une unité dans un bloc réel.
  const [adminProjects, setAdminProjects] = useState<AdminProject[]>([]);
  const [addMode, setAddMode] = useState(false);
  const [newBlockId, setNewBlockId] = useState('');
  const [newUnitType, setNewUnitType] = useState<UnitType>('STUDIO');
  const [newSurface, setNewSurface] = useState('');
  const [newFloor, setNewFloor] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [addingUnit, setAddingUnit] = useState(false);
  const [addUnitError, setAddUnitError] = useState('');
  const [addUnitSuccess, setAddUnitSuccess] = useState('');
  const [deletingUnit, setDeletingUnit] = useState(false);

  const loadApiUnits = useCallback(async () => {
    setLoadingUnits(true);
    setUnitsError('');
    try {
      const projects = await fetchAdminProjects();
      setAdminProjects(projects);
      const project = projects[0];
      if (project) {
        setProjectId(project.id);
        setData((previous) => {
          if (!previous) return previous;
          const marketing = project.marketingInfo;
          return {
            ...previous,
            name: marketing?.name ?? project.name,
            location: marketing?.location ?? project.location,
            titleDeed: marketing?.titleDeed ?? previous.titleDeed,
            totalLandArea: marketing?.totalLandArea ?? previous.totalLandArea,
            deliveryDate: marketing?.deliveryDate ?? previous.deliveryDate,
            notaryName: marketing?.notaryName ?? previous.notaryName,
            escrowBank: marketing?.escrowBank ?? previous.escrowBank,
            views: project.views ?? previous.views,
          };
        });
      }
      // Source admin uniquement (GET /admin/projects) : seule à montrer les
      // ARCHIVE (restauration en un clic) et les blocs réels du formulaire
      // d'ajout — le catalogue public exclut les deux.
      setUnits(flattenAdminUnits(projects));
    } catch (e) {
      setUnitsError(e instanceof Error ? e.message : 'Impossible de charger les unités.');
    } finally {
      setLoadingUnits(false);
    }
  }, []);

  useEffect(() => {
    void loadApiUnits();
  }, [loadApiUnits]);

  const refreshSelectedUnit = useCallback(async (unitId: string) => {
    // Recharge depuis la source admin complète (pas la fiche publique, qui
    // renvoie un corps vide pour une unité ARCHIVE) puis resynchronise le
    // tableau et la sélection courante.
    const projects = await fetchAdminProjects();
    const all = flattenAdminUnits(projects);
    const refreshed = all.find((u) => u.id === unitId) ?? null;
    setUnits(all);
    return refreshed;
  }, []);

  if (!data) return null;

  const handleSaveAll = async () => {
    if (!projectId) return;
    await adminUpdateProject(projectId, {
      name: data.name,
      location: data.location,
      marketingInfo: {
        name: data.name,
        location: data.location,
        titleDeed: data.titleDeed,
        totalLandArea: data.totalLandArea,
        deliveryDate: data.deliveryDate,
        notaryName: data.notaryName,
        escrowBank: data.escrowBank,
      },
      views: data.views,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const UNIT_STATUS_OPTIONS: UnitStatus[] = ['DISPONIBLE', 'RESERVE', 'VENDU', 'LIVRE', 'ARCHIVE'];
  const MEDIA_TYPE_OPTIONS: UnitMediaType[] = ['RENDU_3D', 'PHOTO', 'PHOTO_REELLE', 'PLAN'];

  const selectedUnit = units.find((u) => u.id === selectedUnitId) ?? null;

  const selectUnit = (unit: CatalogUnit) => {
    setSelectedUnitId(unit.id);
    setPriceInput(unit.price);
    setStatusInput(unit.status);
    setUnitActionError('');
    setUnitActionSuccess('');
    setMediaActionError('');
    setMediaActionSuccess('');
  };

  const handleSaveUnit = async () => {
    if (!selectedUnit) return;
    setSavingUnit(true);
    setUnitActionError('');
    setUnitActionSuccess('');
    try {
      const price = Number(priceInput);
      if (!Number.isFinite(price) || price < 0) {
        throw new Error('Le prix doit être un montant positif.');
      }
      await adminUpdateUnit(selectedUnit.id, { price, status: statusInput });
      const refreshed = await refreshSelectedUnit(selectedUnit.id);
      if (refreshed) {
        setPriceInput(refreshed.price);
        setStatusInput(refreshed.status);
      }
      setUnitActionSuccess('Prix et statut enregistrés (base de données).');
    } catch (e) {
      setUnitActionError(e instanceof Error ? e.message : 'Échec de la sauvegarde.');
    } finally {
      setSavingUnit(false);
    }
  };

  const handleAddMedia = async () => {
    if (!selectedUnit) return;
    setSavingMedia(true);
    setMediaActionError('');
    setMediaActionSuccess('');
    try {
      const url = mediaUrlInput.trim();
      if (!url) throw new Error('L’URL du média est requise.');
      await adminAddUnitMedia(selectedUnit.id, { type: mediaTypeInput, url });
      await refreshSelectedUnit(selectedUnit.id);
      setMediaUrlInput('');
      setMediaActionSuccess('Média ajouté.');
    } catch (e) {
      setMediaActionError(e instanceof Error ? e.message : 'Impossible d’ajouter le média.');
    } finally {
      setSavingMedia(false);
    }
  };

  const handleUploadMedia = async () => {
    if (!selectedUnit) return;
    setSavingMedia(true);
    setMediaActionError('');
    setMediaActionSuccess('');
    try {
      if (!mediaFileInput) throw new Error('Sélectionnez un fichier à uploader.');
      await uploadUnitMedia(selectedUnit.id, { type: mediaTypeInput }, mediaFileInput);
      await refreshSelectedUnit(selectedUnit.id);
      setMediaFileInput(null);
      setMediaActionSuccess('Média uploadé sur le stockage public.');
    } catch (e) {
      setMediaActionError(e instanceof Error ? e.message : 'Impossible d’uploader le média.');
    } finally {
      setSavingMedia(false);
    }
  };

  const handleUpdateMedia = async (media: UnitMedia, patch: { type?: UnitMediaType; sortOrder?: number; url?: string }) => {
    if (!selectedUnit) return;
    setMediaActionError('');
    setMediaActionSuccess('');
    try {
      await adminUpdateMedia(media.id, patch);
      await refreshSelectedUnit(selectedUnit.id);
      setMediaActionSuccess('Média mis à jour.');
    } catch (e) {
      setMediaActionError(e instanceof Error ? e.message : 'Impossible de modifier le média.');
    }
  };

  const handleDeleteMedia = async (media: UnitMedia) => {
    if (!selectedUnit) return;
    setMediaActionError('');
    setMediaActionSuccess('');
    try {
      await adminDeleteMedia(media.id);
      await refreshSelectedUnit(selectedUnit.id);
      setMediaActionSuccess('Média supprimé.');
    } catch (e) {
      setMediaActionError(e instanceof Error ? e.message : 'Impossible de supprimer le média.');
    }
  };

  const handleAddNewUnitToBase = async () => {
    setAddingUnit(true);
    setAddUnitError('');
    setAddUnitSuccess('');
    try {
      if (!newBlockId) throw new Error('Sélectionnez un bloc.');
      const surface = Number(newSurface);
      if (!Number.isFinite(surface) || surface <= 0) {
        throw new Error('La surface doit être un nombre positif.');
      }
      const floor = Number(newFloor);
      if (!Number.isInteger(floor) || floor < 0) {
        throw new Error('L’étage doit être un entier positif.');
      }
      const price = Number(newPrice);
      if (!Number.isFinite(price) || price < 0) {
        throw new Error('Le prix doit être un montant positif.');
      }
      const created = await adminCreateUnit({ blockId: newBlockId, type: newUnitType, surface, floor, price });
      await loadApiUnits();
      setSelectedUnitId(created.id);
      setAddMode(false);
      setNewSurface('');
      setNewFloor('');
      setNewPrice('');
      setAddUnitSuccess(`Unité ${created.id} ajoutée au bloc.`);
    } catch (e) {
      setAddUnitError(e instanceof Error ? e.message : 'Impossible d’ajouter l’unité.');
    } finally {
      setAddingUnit(false);
    }
  };

  const handleArchiveUnit = async (unit: CatalogUnit, archive: boolean) => {
    if (!confirm(archive
      ? `Archiver ${unit.type} · ${unit.block.name} (Étage ${unit.floor}) ? Elle sera retirée du catalogue public mais restera en base (restaurable).`
      : `Restaurer ${unit.type} · ${unit.block.name} (Étage ${unit.floor}) dans le catalogue public ?`)) {
      return;
    }
    setUnitActionError('');
    setUnitActionSuccess('');
    try {
      await adminUpdateUnit(unit.id, { status: archive ? 'ARCHIVE' : 'DISPONIBLE' });
      const refreshed = await refreshSelectedUnit(unit.id);
      if (refreshed) {
        setPriceInput(refreshed.price);
        setStatusInput(refreshed.status);
      }
      setUnitActionSuccess(archive ? 'Unité archivée (retirée du catalogue public).' : 'Unité restaurée dans le catalogue public.');
    } catch (e) {
      setUnitActionError(e instanceof Error ? e.message : 'Impossible de modifier le statut.');
    }
  };

  const handleDeleteUnitPermanently = async (unit: CatalogUnit) => {
    if (!confirm(`Suppression DÉFINITIVE (base de données) de ${unit.type} · ${unit.block.name} (Étage ${unit.floor}) ?\n\nCette action est irréversible. Les unités avec un historique de réservation ne peuvent pas être supprimées (bouton API 409).`)) {
      return;
    }
    setDeletingUnit(true);
    setUnitActionError('');
    setUnitActionSuccess('');
    try {
      await adminDeleteUnit(unit.id);
      setUnits((prev) => prev.filter((u) => u.id !== unit.id));
      if (selectedUnitId === unit.id) setSelectedUnitId(null);
      setUnitActionSuccess('Unité supprimée définitivement de la base.');
    } catch (e) {
      setUnitActionError(
        e instanceof Error ? e.message : 'Suppression refusée par l’API (unité avec historique). Utilisez « Archiver ».',
      );
    } finally {
      setDeletingUnit(false);
    }
  };

  const handleUpdateComplexField = (field: keyof ComplexInfo, value: string) => {
    setData((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleUpdateViewField = <K extends keyof ComplexView>(
    viewId: string,
    field: K,
    value: ComplexView[K],
  ) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        views: prev.views.map((v) => (v.id === viewId ? { ...v, [field]: value } : v)),
      };
    });
  };

  const handleAddNewView = () => {
    const newId = 'view-' + Date.now();
    const newView: ComplexView = {
      id: newId,
      title: 'Nouvelle Vue HD',
      subtitle: 'Description courte de la vue',
      category: 'aerial',
      imageUrl: '/masterplan-les-terrasses.jpg',
      description: 'Détails de cette vue d\'ensemble...',
      hotspots: [],
    };
    setData((prev) => (prev ? { ...prev, views: [...prev.views, newView] } : prev));
    setEditingView(newView);
  };

  const handleDeleteView = (viewId: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette vue du complexe ?')) {
      setData((prev) => (prev ? { ...prev, views: prev.views.filter((v) => v.id !== viewId) } : prev));
      if (editingView?.id === viewId) setEditingView(null);
    }
  };

  return (
    <main className="min-h-screen bg-ink text-paper font-sans">
      <Navbar />

      {/* Admin Top Header */}
      <section className="pt-10 pb-8 bg-ink-dark border-b border-paper/15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-sand uppercase mb-1">
              <Sparkles className="w-4 h-4 text-laterite-light" /> Espace Administration Promoteur (Sans-Code)
            </div>
            <h1 className="font-serif text-2xl sm:text-4xl font-semibold text-paper">
              Gestionnaire du Catalogue VEFA 3D
            </h1>
            <p className="text-xs font-mono text-paper/60 mt-1">
              Modifiez vos vues, visuels, boutons, prix et descriptifs en autonomie sans écrire de code.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/catalogue"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-ink-card hover:bg-paper/10 border border-paper/20 text-paper font-mono text-xs px-4 py-2.5 rounded-lg inline-flex items-center gap-2 transition-all"
            >
              <Eye className="w-4 h-4 text-sand" /> Aperçu Onglet Catalogue
            </a>

            <button
              onClick={handleSaveAll}
              title="Sauvegarde locale (aperçu) — utilisez la section « Unités de la base (API) » pour persister en base."
              className="bg-laterite hover:bg-laterite-light text-paper font-mono text-xs font-bold px-5 py-2.5 rounded-lg inline-flex items-center gap-2 transition-all shadow-lg"
            >
              <Save className="w-4 h-4" /> Enregistrer les Modifications
            </button>
          </div>
        </div>
      </section>

      {/* Success Notification Alert */}
      {savedSuccess && (
        <div className="bg-lagoon text-paper p-4 text-center font-mono text-xs flex items-center justify-center gap-2 font-bold transition-all">
          <CheckCircle className="w-5 h-5 text-paper" />
          Modifications enregistrées avec succès ! Le catalogue public s'est mis à jour.
        </div>
      )}

      {/* Admin Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {/* Real Units Editor (API) */}
        <div className="bg-ink-card border border-sand/40 rounded-xl p-6 space-y-5 shadow-xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b border-paper/15 pb-3">
            <div>
              <h3 className="font-serif text-xl font-semibold text-paper flex items-center gap-2">
                <Database className="w-5 h-5 text-sand" /> Unités de la base (API)
              </h3>
              <p className="text-xs font-mono text-paper/60 mt-1">
                Prix, statut et médias persistés en base via l'API — visibles par les visiteurs immédiatement.
              </p>
            </div>
            <button
              onClick={() => void loadApiUnits()}
              className="bg-paper/10 hover:bg-paper/20 text-paper font-mono text-xs px-4 py-2.5 rounded-lg inline-flex items-center gap-2 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Recharger
            </button>
          </div>

          {!addMode && (
            <button
              onClick={() => setAddMode(true)}
              className="bg-lagoon hover:bg-lagoon-light text-paper font-mono text-xs font-bold px-4 py-2.5 rounded-lg inline-flex items-center gap-2 transition-all shadow-md"
            >
              <Plus className="w-4 h-4" /> Créer une unité dans un bloc réel
            </button>
          )}

          {addMode && (
            <div className="bg-ink border border-lagoon/40 rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-serif text-base font-semibold text-paper">
                  Créer une unité (insérée en base via POST /admin/units)
                </h4>
                <button
                  onClick={() => setAddMode(false)}
                  className="text-paper/60 hover:text-paper text-xs font-mono"
                  title="Fermer"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                <div>
                  <label className="block text-paper/70 mb-1">Bloc (réel)</label>
                  <select
                    value={newBlockId}
                    onChange={(e) => setNewBlockId(e.target.value)}
                    className="w-full bg-ink-card border border-paper/20 rounded-lg p-2.5 text-paper focus:border-sand outline-none"
                  >
                    <option value="">— Sélectionner —</option>
                    {adminProjects.flatMap((p) =>
                      p.blocks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {p.name} · {b.name} ({b.floors} étages)
                        </option>
                      )),
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-paper/70 mb-1">Type</label>
                  <select
                    value={newUnitType}
                    onChange={(e) => setNewUnitType(e.target.value as UnitType)}
                    className="w-full bg-ink-card border border-paper/20 rounded-lg p-2.5 text-paper focus:border-sand outline-none"
                  >
                    {(['STUDIO', 'T2', 'T3', 'T4', 'T5'] as UnitType[]).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-paper/70 mb-1">Surface (m²)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={newSurface}
                    onChange={(e) => setNewSurface(e.target.value)}
                    placeholder="ex : 45,5"
                    className="w-full bg-ink-card border border-paper/20 rounded-lg p-2.5 text-paper focus:border-sand outline-none"
                  />
                </div>
                <div>
                  <label className="block text-paper/70 mb-1">Étage</label>
                  <input
                    type="number"
                    min={0}
                    value={newFloor}
                    onChange={(e) => setNewFloor(e.target.value)}
                    placeholder="ex : 2"
                    className="w-full bg-ink-card border border-paper/20 rounded-lg p-2.5 text-paper focus:border-sand outline-none"
                  />
                </div>
                <div>
                  <label className="block text-paper/70 mb-1">Prix (XOF)</label>
                  <input
                    type="number"
                    min={0}
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="ex : 25000000"
                    className="w-full bg-ink-card border border-paper/20 rounded-lg p-2.5 text-paper focus:border-sand outline-none"
                  />
                </div>
              </div>

              {addUnitError && (
                <div className="bg-laterite/15 border border-laterite/40 rounded p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-laterite-light shrink-0" />
                  <p className="text-xs text-paper font-mono">{addUnitError}</p>
                </div>
              )}
              {addUnitSuccess && (
                <div className="bg-lagoon/15 border border-lagoon/40 rounded p-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-lagoon-light shrink-0" />
                  <p className="text-xs text-paper font-mono">{addUnitSuccess}</p>
                </div>
              )}

              <button
                onClick={() => void handleAddNewUnitToBase()}
                disabled={addingUnit}
                className="w-full md:w-auto bg-lagoon hover:bg-lagoon-light text-paper font-mono text-xs font-bold px-5 py-2.5 rounded-lg inline-flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              >
                {addingUnit ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Création…
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" /> Créer l'unité
                  </>
                )}
              </button>
            </div>
          )}

          {loadingUnits && (
            <div className="flex items-center justify-center gap-3 font-mono text-xs text-paper/60 py-10">
              <Loader2 className="w-5 h-5 animate-spin text-laterite-light" /> Chargement des unités…
            </div>
          )}

          {!loadingUnits && unitsError && (
            <div className="bg-laterite/15 border border-laterite/40 rounded-md p-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-laterite-light shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-paper font-mono">{unitsError}</p>
                <button
                  onClick={() => void loadApiUnits()}
                  className="mt-3 bg-paper/10 hover:bg-paper/20 text-paper font-mono text-xs px-4 py-2 rounded transition-all"
                >
                  Réessayer
                </button>
              </div>
            </div>
          )}

          {!loadingUnits && !unitsError && units.length === 0 && (
            <div className="bg-ink border border-paper/20 rounded-md p-10 text-center font-mono text-xs text-paper/70">
              Aucune unité trouvée dans la base (tous statuts, brouillons inclus).
            </div>
          )}

          {!loadingUnits && !unitsError && units.length > 0 && (
            <div className="space-y-4">
              <div className="max-h-56 overflow-y-auto rounded-md border border-paper/15">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-ink sticky top-0">
                    <tr className="text-paper/50 border-b border-paper/15">
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Bloc</th>
                      <th className="px-3 py-2">Étage</th>
                      <th className="px-3 py-2">Prix (XOF)</th>
                      <th className="px-3 py-2">Statut</th>
                      <th className="px-3 py-2">Médias</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {units.map((u) => (
                      <tr
                        key={u.id}
                        onClick={() => selectUnit(u)}
                        className={`border-b border-paper/10 cursor-pointer transition-all ${
                          selectedUnitId === u.id ? 'bg-sand/15' : 'hover:bg-paper/5'
                        }`}
                      >
                        <td className="px-3 py-2 text-paper font-bold">{u.type}</td>
                        <td className="px-3 py-2 text-paper/80">{u.block.name}</td>
                        <td className="px-3 py-2 text-paper/80">{u.floor}</td>
                        <td className="px-3 py-2 text-laterite-light font-bold">
                          {Number(u.price).toLocaleString('fr-FR')}
                        </td>
                        <td className="px-3 py-2">
                          <span className="bg-paper/10 text-paper/80 border border-paper/20 px-2 py-0.5 rounded">
                            {u.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-paper/80">{u.media.length}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sand font-mono">Éditer →</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); void handleArchiveUnit(u, u.status !== 'ARCHIVE'); }}
                              title={u.status === 'ARCHIVE' ? 'Restaurer dans le catalogue public' : 'Archiver (retirer du catalogue public)'}
                              className={`px-2 py-1 rounded text-[10px] font-mono border transition-all ${
                                u.status === 'ARCHIVE'
                                  ? 'bg-lagoon/15 text-lagoon-light border-lagoon/40 hover:bg-lagoon/25'
                                  : 'bg-paper/10 text-paper/80 border-paper/20 hover:bg-paper/20'
                              }`}
                            >
                              {u.status === 'ARCHIVE' ? 'Restaurer' : 'Archiver'}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); void handleDeleteUnitPermanently(u); }}
                              disabled={deletingUnit}
                              title="Suppression SQL définitive — rare, réservée aux unités sans réservation"
                              className="px-2 py-1 rounded text-[10px] font-mono bg-laterite/15 text-laterite-light border border-laterite/40 hover:bg-laterite/25 transition-all disabled:opacity-60"
                            >
                              Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedUnit && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Prix & statut */}
                  <div className="bg-ink border border-paper/20 rounded-lg p-5 space-y-4">
                    <h4 className="font-serif text-base font-semibold text-paper border-b border-paper/15 pb-2">
                      Prix & Statut — {selectedUnit.type} · {selectedUnit.block.name} (Étage {selectedUnit.floor})
                    </h4>

                    <div className="grid grid-cols-2 gap-4 font-mono text-xs">
                      <div>
                        <label className="block text-paper/70 mb-1">Prix (XOF)</label>
                        <input
                          type="number"
                          min={0}
                          value={priceInput}
                          onChange={(e) => setPriceInput(e.target.value)}
                          className="w-full bg-ink-card border border-paper/20 rounded-lg p-2.5 text-paper focus:border-sand outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-paper/70 mb-1">Statut</label>
                        <select
                          value={statusInput}
                          onChange={(e) => setStatusInput(e.target.value as UnitStatus)}
                          className="w-full bg-ink-card border border-paper/20 rounded-lg p-2.5 text-paper focus:border-sand outline-none"
                        >
                          {UNIT_STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {unitActionError && (
                      <div className="bg-laterite/15 border border-laterite/40 rounded p-3 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-laterite-light shrink-0" />
                        <p className="text-xs text-paper font-mono">{unitActionError}</p>
                      </div>
                    )}
                    {unitActionSuccess && (
                      <div className="bg-lagoon/15 border border-lagoon/40 rounded p-3 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-lagoon-light shrink-0" />
                        <p className="text-xs text-paper font-mono">{unitActionSuccess}</p>
                      </div>
                    )}

                    <button
                      onClick={() => void handleSaveUnit()}
                      disabled={savingUnit}
                      className="w-full bg-laterite hover:bg-laterite-light text-paper font-mono text-xs font-bold py-2.5 rounded-lg inline-flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                    >
                      {savingUnit ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" /> Enregistrer (prix & statut)
                        </>
                      )}
                    </button>
                  </div>

                  {/* Médias */}
                  <div className="bg-ink border border-paper/20 rounded-lg p-5 space-y-4">
                    <h4 className="font-serif text-base font-semibold text-paper border-b border-paper/15 pb-2">
                      Médias ({selectedUnit.media.length})
                    </h4>

                    {mediaActionError && (
                      <div className="bg-laterite/15 border border-laterite/40 rounded p-3 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-laterite-light shrink-0" />
                        <p className="text-xs text-paper font-mono">{mediaActionError}</p>
                      </div>
                    )}
                    {mediaActionSuccess && (
                      <div className="bg-lagoon/15 border border-lagoon/40 rounded p-3 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-lagoon-light shrink-0" />
                        <p className="text-xs text-paper font-mono">{mediaActionSuccess}</p>
                      </div>
                    )}

                    {selectedUnit.media.length === 0 ? (
                      <p className="text-xs text-paper/60 font-mono">
                        Aucun média sur cette unité pour le moment.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {selectedUnit.media.map((m) => (
                          <li
                            key={m.id}
                            className="bg-ink-card border border-paper/15 rounded-lg p-3 font-mono text-xs space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sand font-bold">{m.type}</span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => void handleUpdateMedia(m, { type: m.type === 'RENDU_3D' ? 'PHOTO' : 'RENDU_3D' })}
                                  className="text-lagoon-light hover:underline"
                                  title="Basculer le type"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => void handleDeleteMedia(m)}
                                  className="text-laterite hover:text-laterite-light"
                                  title="Supprimer ce média"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <p className="text-paper/60 break-all">{m.url}</p>
                            <div className="flex items-center gap-2">
                              <label className="text-paper/50">Ordre</label>
                              <input
                                type="number"
                                min={0}
                                defaultValue={m.sortOrder}
                                onBlur={(e) => void handleUpdateMedia(m, { sortOrder: Number(e.target.value) })}
                                className="w-20 bg-ink border border-paper/20 rounded p-1.5 text-paper"
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="pt-3 border-t border-paper/15 space-y-3">
                      <div className="grid grid-cols-2 gap-4 font-mono text-xs">
                        <div>
                          <label className="block text-paper/70 mb-1">Type</label>
                          <select
                            value={mediaTypeInput}
                            onChange={(e) => setMediaTypeInput(e.target.value as UnitMediaType)}
                            className="w-full bg-ink-card border border-paper/20 rounded-lg p-2.5 text-paper focus:border-sand outline-none"
                          >
                            {MEDIA_TYPE_OPTIONS.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-paper/70 mb-1">URL</label>
                          <input
                            type="text"
                            value={mediaUrlInput}
                            onChange={(e) => setMediaUrlInput(e.target.value)}
                            placeholder="https://…"
                            className="w-full bg-ink-card border border-paper/20 rounded-lg p-2.5 text-paper focus:border-sand outline-none"
                          />
                        </div>
                      </div>

                      <div className="border-t border-paper/15 pt-3 space-y-2">
                        <label className="block text-paper/70 font-mono text-xs">
                          Upload depuis l'ordinateur (rendus, photos, plans — PNG, JPG, WebP, PDF, ≤ 15 Mo)
                        </label>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,application/pdf"
                          onChange={(e) => setMediaFileInput(e.target.files?.[0] ?? null)}
                          className="w-full text-xs text-paper/70 font-mono file:mr-3 file:rounded-lg file:border file:border-sand/40 file:bg-ink-card file:px-3 file:py-2 file:text-paper file:font-mono file:cursor-pointer hover:file:bg-ink"
                        />
                        {mediaFileInput && (
                          <p className="text-[11px] font-mono text-lagoon-light break-all">
                            {mediaFileInput.name} — {(mediaFileInput.size / (1024 * 1024)).toFixed(2)} Mo
                          </p>
                        )}
                        <button
                          onClick={() => void handleUploadMedia()}
                          disabled={savingMedia || !mediaFileInput}
                          className="w-full bg-sand/20 hover:bg-sand/30 text-sand font-mono text-xs font-bold py-2.5 rounded-lg inline-flex items-center justify-center gap-2 transition-all disabled:opacity-60 border border-sand/40"
                        >
                          {savingMedia ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" /> Upload…
                            </>
                          ) : (
                            <>
                              <Image className="w-4 h-4" /> Uploader le média
                            </>
                          )}
                        </button>
                      </div>

                      <button
                        onClick={() => void handleAddMedia()}
                        disabled={savingMedia}
                        className="w-full bg-lagoon hover:bg-lagoon-light text-paper font-mono text-xs font-bold py-2.5 rounded-lg inline-flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                      >
                        {savingMedia ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Ajout…
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" /> Ajouter le média
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* General Complex Info Editor Card */}
        <div className="bg-ink-card border border-paper/20 rounded-xl p-6 space-y-4 shadow-xl">
          <h3 className="font-serif text-xl font-semibold text-paper border-b border-paper/15 pb-3 flex items-center gap-2">
            <Building className="w-5 h-5 text-sand" /> Informations Générales de la Résidence
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
            <div>
              <label className="block text-paper/70 mb-1">Nom du Complexe</label>
              <input
                type="text"
                value={data.name}
                onChange={(e) => handleUpdateComplexField('name', e.target.value)}
                className="w-full bg-ink border border-paper/20 rounded-lg p-2.5 text-paper focus:border-sand outline-none"
              />
            </div>
            <div>
              <label className="block text-paper/70 mb-1">Titre Foncier (Référence Officielle)</label>
              <input
                type="text"
                value={data.titleDeed}
                onChange={(e) => handleUpdateComplexField('titleDeed', e.target.value)}
                className="w-full bg-ink border border-paper/20 rounded-lg p-2.5 text-paper focus:border-sand outline-none"
              />
            </div>
            <div>
              <label className="block text-paper/70 mb-1">Localisation & Ville</label>
              <input
                type="text"
                value={data.location}
                onChange={(e) => handleUpdateComplexField('location', e.target.value)}
                className="w-full bg-ink border border-paper/20 rounded-lg p-2.5 text-paper focus:border-sand outline-none"
              />
            </div>
            <div>
              <label className="block text-paper/70 mb-1">Date de Livraison Estimée</label>
              <input
                type="text"
                value={data.deliveryDate}
                onChange={(e) => handleUpdateComplexField('deliveryDate', e.target.value)}
                className="w-full bg-ink border border-paper/20 rounded-lg p-2.5 text-paper focus:border-sand outline-none"
              />
            </div>
          </div>
        </div>

        {/* Complex Views Management Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-serif text-2xl font-semibold text-paper flex items-center gap-2">
                <Layers className="w-6 h-6 text-sand" /> Vues du Complexe & Boutons Interactifs ({data.views.length})
                <span className="text-[10px] font-mono bg-paper/10 text-paper/60 border border-paper/20 px-2 py-0.5 rounded uppercase">
                  Aperçu local (non persistant)
                </span>
              </h3>
              <p className="text-xs font-mono text-paper/60">
                Ajoutez ou éditez les vues (Plan de masse, Vue aérienne, Jardins) et leurs boutons d'accès.
              </p>
            </div>
            <button
              onClick={handleAddNewView}
              className="bg-lagoon hover:bg-lagoon-light text-paper font-mono text-xs font-bold px-4 py-2.5 rounded-lg inline-flex items-center gap-2 transition-all shadow-md"
            >
              <Plus className="w-4 h-4" /> Ajouter une Vue HD
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.views.map((view) => (
              <div
                key={view.id}
                className="bg-ink-card border border-paper/20 rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-lg hover:border-sand transition-all"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-mono bg-paper/10 text-sand px-2 py-0.5 rounded border border-paper/20 uppercase">
                      {view.category}
                    </span>
                    <button
                      onClick={() => handleDeleteView(view.id)}
                      className="text-laterite hover:text-laterite-light p-1"
                      title="Supprimer la vue"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <h4 className="font-serif text-lg font-semibold text-paper mb-1">{view.title}</h4>
                  <div className="font-mono text-xs text-sand mb-2">{view.subtitle}</div>
                  <p className="text-xs text-paper/70 line-clamp-2 mb-3">{view.description}</p>

                  <div className="text-[11px] font-mono text-paper/60">
                    Boutons interactifs superposés : <strong>{view.hotspots?.length || 0} boutons</strong>
                  </div>
                </div>

                <button
                  onClick={() => setEditingView(view)}
                  className="w-full bg-paper/10 hover:bg-laterite text-paper font-mono text-xs py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 font-bold"
                >
                  <Edit className="w-3.5 h-3.5" /> Éditer la Vue & les Boutons Hotspots
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* View Editor Modal */}
        {editingView && (
          <div className="fixed inset-0 z-50 bg-ink-dark/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-ink border border-paper/30 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
              <div className="flex justify-between items-center border-b border-paper/15 pb-4">
                <h3 className="font-serif text-xl font-semibold text-paper">Édition de la Vue : {editingView.title}</h3>
                <button
                  onClick={() => setEditingView(null)}
                  className="text-paper/60 hover:text-paper font-mono text-xs px-3 py-1 bg-paper/10 rounded"
                >
                  Fermer
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
                <div>
                  <label className="block text-paper/70 mb-1">Titre du bouton / de la Vue</label>
                  <input
                    type="text"
                    value={editingView.title}
                    onChange={(e) => handleUpdateViewField(editingView.id, 'title', e.target.value)}
                    className="w-full bg-ink-card border border-paper/20 rounded-lg p-2.5 text-paper outline-none focus:border-sand"
                  />
                </div>
                <div>
                  <label className="block text-paper/70 mb-1">Sous-Titre / Légende</label>
                  <input
                    type="text"
                    value={editingView.subtitle}
                    onChange={(e) => handleUpdateViewField(editingView.id, 'subtitle', e.target.value)}
                    className="w-full bg-ink-card border border-paper/20 rounded-lg p-2.5 text-paper outline-none focus:border-sand"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-paper/70 mb-1">URL de l'image (Ex: /masterplan-les-terrasses.jpg ou HTTPS)</label>
                  <input
                    type="text"
                    value={editingView.imageUrl}
                    onChange={(e) => handleUpdateViewField(editingView.id, 'imageUrl', e.target.value)}
                    className="w-full bg-ink-card border border-paper/20 rounded-lg p-2.5 text-paper outline-none focus:border-sand"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-paper/70 mb-1">Description explicative pour les clients</label>
                  <textarea
                    rows={3}
                    value={editingView.description}
                    onChange={(e) => handleUpdateViewField(editingView.id, 'description', e.target.value)}
                    className="w-full bg-ink-card border border-paper/20 rounded-lg p-2.5 text-paper outline-none focus:border-sand"
                  />
                </div>
              </div>

              {/* Hotspots Buttons Editor */}
              <div className="pt-4 border-t border-paper/15 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-serif text-base font-semibold text-sand flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Boutons Hotspots Superposés ({editingView.hotspots?.length || 0})
                  </h4>
                  <button
                    onClick={() => {
                      const newHotspots = [
                        ...(editingView.hotspots || []),
                        {
                          id: 'hs-' + Date.now(),
                          label: 'Nouveau Bouton Bloc',
                          targetBlockId: 'unit-studio',
                          top: '50%',
                          left: '50%',
                        },
                      ];
                      handleUpdateViewField(editingView.id, 'hotspots', newHotspots);
                    }}
                    className="bg-lagoon/20 text-lagoon-light border border-lagoon/40 hover:bg-lagoon/30 px-3 py-1.5 rounded text-xs font-mono flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Ajouter un Bouton
                  </button>
                </div>

                <div className="space-y-3 font-mono text-xs">
                  {editingView.hotspots?.map((hs, hsIdx) => (
                    <div key={hs.id} className="bg-ink-card p-3 rounded-lg border border-paper/15 flex flex-col sm:flex-row items-center gap-3">
                      <div className="flex-1 space-y-1 w-full">
                        <label className="text-[10px] text-paper/50 block">Intitulé du bouton</label>
                        <input
                          type="text"
                          value={hs.label}
                          onChange={(e) => {
                            const updated = [...(editingView.hotspots || [])];
                            updated[hsIdx].label = e.target.value;
                            handleUpdateViewField(editingView.id, 'hotspots', updated);
                          }}
                          className="w-full bg-ink border border-paper/20 rounded p-1.5 text-paper"
                        />
                      </div>
                      <div className="w-28 space-y-1">
                        <label className="text-[10px] text-paper/50 block">Position Hauteur (Top %)</label>
                        <input
                          type="text"
                          value={hs.top}
                          onChange={(e) => {
                            const updated = [...(editingView.hotspots || [])];
                            updated[hsIdx].top = e.target.value;
                            handleUpdateViewField(editingView.id, 'hotspots', updated);
                          }}
                          className="w-full bg-ink border border-paper/20 rounded p-1.5 text-paper"
                        />
                      </div>
                      <div className="w-28 space-y-1">
                        <label className="text-[10px] text-paper/50 block">Position Largeur (Left %)</label>
                        <input
                          type="text"
                          value={hs.left}
                          onChange={(e) => {
                            const updated = [...(editingView.hotspots || [])];
                            updated[hsIdx].left = e.target.value;
                            handleUpdateViewField(editingView.id, 'hotspots', updated);
                          }}
                          className="w-full bg-ink border border-paper/20 rounded p-1.5 text-paper"
                        />
                      </div>
                      <button
                        onClick={() => {
                          const updated = (editingView.hotspots || []).filter((_, i) => i !== hsIdx);
                          handleUpdateViewField(editingView.id, 'hotspots', updated);
                        }}
                        className="text-laterite hover:text-laterite-light p-1 self-end sm:self-center"
                        title="Supprimer ce bouton"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-paper/15 flex justify-end gap-3">
                <button
                  onClick={() => {
                    handleSaveAll();
                    setEditingView(null);
                  }}
                  className="bg-laterite hover:bg-laterite-light text-paper font-mono text-xs font-bold px-6 py-3 rounded-lg shadow-lg"
                >
                  Valider & Enregistrer
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      <Footer />
    </main>
  );
}
