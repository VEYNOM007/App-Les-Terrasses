'use client';

import React, { useState } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { HardHat, FileText, CheckCircle, Clock, ShieldCheck, Upload, AlertTriangle } from 'lucide-react';

export default function ArtisanWorkspace() {
  const artisanProfile = {
    name: 'Amouzou Maçonnerie & Gros Œuvre SARL',
    trade: 'Maçonnerie & Béton armé',
    assignedBlock: 'Bloc C (Rangée Nord-Ouest)',
    scope: 'Fondations et Gros Œuvre — Niveaux RDC à R+3',
    status: 'ACCEPTEE',
  };

  const [quoteAmount, setQuoteAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmitQuote = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <main className="min-h-screen bg-ink text-paper flex flex-col">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1 w-full space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-paper/15">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-mono tracking-widest text-laterite-light uppercase mb-1">
              <HardHat className="w-4 h-4 text-laterite-light" />
              Espace Artisan BTP PWA
            </div>
            <h1 className="font-serif text-3xl font-semibold text-paper">
              Tableau de Bord Chantier
            </h1>
          </div>
          <span className="font-mono text-xs bg-sand/20 text-sand border border-sand/40 px-3 py-1.5 rounded">
            Profil Artisan Actif · Verified
          </span>
        </div>

        {/* Profile & Assignment Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 bg-ink-card border border-paper/20 rounded-md p-6 space-y-4">
            <h3 className="font-serif text-xl font-semibold text-paper border-b border-paper/15 pb-2">
              Mon Affectation
            </h3>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <span className="text-paper/60 block">Entreprise :</span>
                <span className="text-paper font-bold">{artisanProfile.name}</span>
              </div>
              <div>
                <span className="text-paper/60 block">Corps d'état :</span>
                <span className="text-sand">{artisanProfile.trade}</span>
              </div>
              <div>
                <span className="text-paper/60 block">Lot Affecté :</span>
                <span className="text-lagoon-light font-bold">{artisanProfile.assignedBlock}</span>
              </div>
              <div>
                <span className="text-paper/60 block">Périmètre :</span>
                <span className="text-paper/80">{artisanProfile.scope}</span>
              </div>
            </div>

            <div className="p-3 bg-lagoon/15 border-l-2 border-lagoon-light rounded-r font-mono text-xs text-lagoon-light">
              🛡️ Accès restreint uniquement au Bloc C conformément aux règles de sécurité R-Security.
            </div>
          </div>

          {/* Quote Submission & Milestone Reporter */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-ink-card border border-paper/20 rounded-md p-6">
              <h3 className="font-serif text-xl font-semibold text-paper mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-sand" /> Soumettre un Devis / Avancement
              </h3>

              {!submitted ? (
                <form onSubmit={handleSubmitQuote} className="space-y-4">
                  <div>
                    <label className="block font-mono text-xs text-paper/60 uppercase mb-1">Montant estimé (XOF) *</label>
                    <input
                      type="number"
                      required
                      value={quoteAmount}
                      onChange={(e) => setQuoteAmount(e.target.value)}
                      placeholder="Ex: 18500000"
                      className="w-full bg-paper/5 border border-paper/20 rounded p-3 text-sm text-paper font-mono focus:border-laterite-light outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-mono text-xs text-paper/60 uppercase mb-1">Description des travaux *</label>
                    <textarea
                      rows={3}
                      required
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Détail des prestations et fournitures pour le lot..."
                      className="w-full bg-paper/5 border border-paper/20 rounded p-3 text-sm text-paper font-sans focus:border-laterite-light outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="bg-laterite hover:bg-laterite-light text-paper font-mono text-xs px-6 py-3 rounded transition-all font-semibold"
                  >
                    Transmettre le devis pour validation →
                  </button>
                </form>
              ) : (
                <div className="p-4 bg-lagoon/20 border border-lagoon/40 rounded font-mono text-xs text-lagoon-light space-y-2">
                  <div className="font-bold text-sm">Devis de {Number(quoteAmount).toLocaleString()} XOF soumis avec succès !</div>
                  <p className="text-paper/80">Le devis a été transmis à la direction technique pour examen sous 48h.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
