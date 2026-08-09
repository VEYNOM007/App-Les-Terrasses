'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import { getCatalogData, saveCatalogData, ComplexInfo, Unit3DDetails } from '../../../lib/catalogData';
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
  DollarSign
} from 'lucide-react';

export default function AdminCataloguePage() {
  const [data, setData] = useState<ComplexInfo | null>(null);
  const [editingUnit, setEditingUnit] = useState<Unit3DDetails | null>(null);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    setData(getCatalogData());
  }, []);

  if (!data) return null;

  const handleSaveAll = () => {
    saveCatalogData(data);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleUpdateComplexField = (field: keyof ComplexInfo, value: string) => {
    setData((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleUpdateUnitField = (unitId: string, field: keyof Unit3DDetails, value: any) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        units: prev.units.map((u) => (u.id === unitId ? { ...u, [field]: value } : u)),
      };
    });
  };

  const handleAddNewUnit = () => {
    const newId = 'unit-' + Date.now();
    const newUnit: Unit3DDetails = {
      id: newId,
      name: 'Nouvel Appartement',
      type: 'T3',
      blockId: 'block-a',
      blockName: 'Bloc A - NOUVEAU',
      floor: 'Étage 1',
      surfaceHabitableM2: 50,
      surfaceTerrasseM2: 10,
      surfaceTotaleM2: 60,
      ceilingHeightM: 2.8,
      orientation: 'Sud',
      startingPriceXOF: 35000000,
      startingPriceFormatted: '35 000 000 FCFA',
      availableUnitsCount: 5,
      totalUnitsCount: 10,
      description: 'Description du nouvel appartement...',
      keyFeatures: ['Finition soignée', 'Balcon privatif'],
      renderPhotos: [
        {
          title: 'Séjour 3D',
          url: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80',
          angle: 'séjour',
        },
      ],
      floorPlan2DUrl: 'https://images.unsplash.com/photo-1600585152220-90363fe7e115?auto=format&fit=crop&w=1200&q=80',
      technicalSpecs: [],
      finishingOptions: [],
      estimatedMonthlyRentXOF: 300000,
      estimatedNetYieldAnnual: 10.5,
    };

    setData((prev) => (prev ? { ...prev, units: [...prev.units, newUnit] } : prev));
    setEditingUnit(newUnit);
  };

  const handleDeleteUnit = (unitId: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cet appartement du catalogue ?')) {
      setData((prev) => (prev ? { ...prev, units: prev.units.filter((u) => u.id !== unitId) } : prev));
      if (editingUnit?.id === unitId) setEditingUnit(null);
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
              Modifiez vos visuels, prix, descriptifs et finitions en autonomie sans écrire de code.
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
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
              <label className="block text-paper/70 mb-1">Titre Foncier (Référence Offcielle)</label>
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

        {/* Apartments Management Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-serif text-2xl font-semibold text-paper">
              Grille des Appartements ({data.units.length})
            </h3>
            <button
              onClick={handleAddNewUnit}
              className="bg-lagoon hover:bg-lagoon-light text-paper font-mono text-xs font-bold px-4 py-2.5 rounded-lg inline-flex items-center gap-2 transition-all shadow-md"
            >
              <Plus className="w-4 h-4" /> Ajouter un Appartement
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.units.map((unit) => (
              <div
                key={unit.id}
                className="bg-ink-card border border-paper/20 rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-lg hover:border-sand transition-all"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-mono bg-paper/10 text-sand px-2 py-0.5 rounded border border-paper/20">
                      {unit.type} · {unit.blockName}
                    </span>
                    <button
                      onClick={() => handleDeleteUnit(unit.id)}
                      className="text-laterite hover:text-laterite-light p-1"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <h4 className="font-serif text-lg font-semibold text-paper mb-1">{unit.name}</h4>
                  <div className="font-mono text-xs text-laterite-light font-bold mb-3">{unit.startingPriceFormatted}</div>

                  <p className="text-xs text-paper/70 line-clamp-2 mb-3">{unit.description}</p>

                  <div className="text-[11px] font-mono text-paper/60 space-y-1 pt-2 border-t border-paper/10">
                    <div>Surface totale : <strong>{unit.surfaceTotaleM2} m²</strong></div>
                    <div>Disponibles : <strong>{unit.availableUnitsCount} lots</strong></div>
                  </div>
                </div>

                <button
                  onClick={() => setEditingUnit(unit)}
                  className="w-full bg-paper/10 hover:bg-laterite text-paper font-mono text-xs py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 font-bold"
                >
                  <Edit className="w-3.5 h-3.5" /> Éditer les Fiches & Photos
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Unit Editor Modal */}
        {editingUnit && (
          <div className="fixed inset-0 z-50 bg-ink-dark/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-ink border border-paper/30 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
              <div className="flex justify-between items-center border-b border-paper/15 pb-4">
                <h3 className="font-serif text-xl font-semibold text-paper">Édition de : {editingUnit.name}</h3>
                <button
                  onClick={() => setEditingUnit(null)}
                  className="text-paper/60 hover:text-paper font-mono text-xs px-3 py-1 bg-paper/10 rounded"
                >
                  Fermer
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
                <div>
                  <label className="block text-paper/70 mb-1">Nom du bien</label>
                  <input
                    type="text"
                    value={editingUnit.name}
                    onChange={(e) => handleUpdateUnitField(editingUnit.id, 'name', e.target.value)}
                    className="w-full bg-ink-card border border-paper/20 rounded-lg p-2.5 text-paper outline-none focus:border-sand"
                  />
                </div>
                <div>
                  <label className="block text-paper/70 mb-1">Bloc & Étage</label>
                  <input
                    type="text"
                    value={editingUnit.blockName}
                    onChange={(e) => handleUpdateUnitField(editingUnit.id, 'blockName', e.target.value)}
                    className="w-full bg-ink-card border border-paper/20 rounded-lg p-2.5 text-paper outline-none focus:border-sand"
                  />
                </div>
                <div>
                  <label className="block text-paper/70 mb-1">Prix de Départ (FCFA)</label>
                  <input
                    type="number"
                    value={editingUnit.startingPriceXOF}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      handleUpdateUnitField(editingUnit.id, 'startingPriceXOF', val);
                      handleUpdateUnitField(
                        editingUnit.id,
                        'startingPriceFormatted',
                        new Intl.NumberFormat('fr-FR').format(val) + ' FCFA'
                      );
                    }}
                    className="w-full bg-ink-card border border-paper/20 rounded-lg p-2.5 text-paper outline-none focus:border-sand"
                  />
                </div>
                <div>
                  <label className="block text-paper/70 mb-1">Nombre de lots disponibles</label>
                  <input
                    type="number"
                    value={editingUnit.availableUnitsCount}
                    onChange={(e) => handleUpdateUnitField(editingUnit.id, 'availableUnitsCount', Number(e.target.value))}
                    className="w-full bg-ink-card border border-paper/20 rounded-lg p-2.5 text-paper outline-none focus:border-sand"
                  />
                </div>
                <div>
                  <label className="block text-paper/70 mb-1">Surface Habitable (m²)</label>
                  <input
                    type="number"
                    value={editingUnit.surfaceHabitableM2}
                    onChange={(e) => {
                      const hab = Number(e.target.value);
                      handleUpdateUnitField(editingUnit.id, 'surfaceHabitableM2', hab);
                      handleUpdateUnitField(editingUnit.id, 'surfaceTotaleM2', hab + editingUnit.surfaceTerrasseM2);
                    }}
                    className="w-full bg-ink-card border border-paper/20 rounded-lg p-2.5 text-paper outline-none focus:border-sand"
                  />
                </div>
                <div>
                  <label className="block text-paper/70 mb-1">Surface Terrasse/Balcon (m²)</label>
                  <input
                    type="number"
                    value={editingUnit.surfaceTerrasseM2}
                    onChange={(e) => {
                      const terr = Number(e.target.value);
                      handleUpdateUnitField(editingUnit.id, 'surfaceTerrasseM2', terr);
                      handleUpdateUnitField(editingUnit.id, 'surfaceTotaleM2', editingUnit.surfaceHabitableM2 + terr);
                    }}
                    className="w-full bg-ink-card border border-paper/20 rounded-lg p-2.5 text-paper outline-none focus:border-sand"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-paper/70 mb-1">Description Commerciale</label>
                  <textarea
                    rows={3}
                    value={editingUnit.description}
                    onChange={(e) => handleUpdateUnitField(editingUnit.id, 'description', e.target.value)}
                    className="w-full bg-ink-card border border-paper/20 rounded-lg p-2.5 text-paper outline-none focus:border-sand"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-paper/70 mb-1">URL Photo Rendu 3D Principal</label>
                  <input
                    type="text"
                    value={editingUnit.renderPhotos[0]?.url || ''}
                    onChange={(e) => {
                      const newPhotos = [...editingUnit.renderPhotos];
                      newPhotos[0] = {
                        title: 'Rendu 3D Principal',
                        url: e.target.value,
                        angle: 'séjour',
                      };
                      handleUpdateUnitField(editingUnit.id, 'renderPhotos', newPhotos);
                    }}
                    className="w-full bg-ink-card border border-paper/20 rounded-lg p-2.5 text-paper outline-none focus:border-sand"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-paper/15 flex justify-end gap-3">
                <button
                  onClick={() => {
                    handleSaveAll();
                    setEditingUnit(null);
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
