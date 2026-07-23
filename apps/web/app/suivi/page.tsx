'use client';

import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { Calendar, CheckCircle2, Clock, FileText, HardHat, ShieldCheck, Download, AlertCircle } from 'lucide-react';

export default function SuiviAcquereur() {
  const reservationInfo = {
    unit: 'Appartement T2 - Lot B-204',
    block: 'Bloc B (Sud-Est)',
    surface: '45 m²',
    status: 'CONFIRMEE',
    price: '24 000 000 XOF',
    acomptePaid: '2 400 000 XOF (10%)',
    launchStatus: 'EN_COMMERCIALISATION (58% / 60% requis)',
  };

  const schedule = [
    { label: 'Acompte de réservation (10%)', amount: '2 400 000 XOF', dueDate: '2026-07-20', status: 'PAYE' },
    { label: 'Tranche Gros Œuvre (30%)', amount: '7 200 000 XOF', dueDate: '2026-10-15', status: 'EN_ATTENTE' },
    { label: 'Tranche Second Œuvre (40%)', amount: '9 600 000 XOF', dueDate: '2027-02-01', status: 'EN_ATTENTE' },
    { label: 'Solde à la remise des clés (20%)', amount: '4 800 000 XOF', dueDate: '2027-06-30', status: 'EN_ATTENTE' },
  ];

  return (
    <main className="min-h-screen bg-ink text-paper flex flex-col">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1 w-full space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-paper/15">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-mono tracking-widest text-sand uppercase mb-1">
              <ShieldCheck className="w-4 h-4 text-lagoon-light" />
              Espace Acquéreur Sécurisé
            </div>
            <h1 className="font-serif text-3xl font-semibold text-paper">
              Suivi de mon Logement & Échéancier
            </h1>
          </div>
          <span className="font-mono text-xs bg-lagoon/20 text-lagoon-light border border-lagoon/40 px-3 py-1.5 rounded">
            Réservation n° RES-2026-884
          </span>
        </div>

        {/* Status Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 bg-ink-card border border-paper/20 rounded-md p-6 space-y-4">
            <h3 className="font-serif text-xl font-semibold text-paper border-b border-paper/15 pb-2">
              Détails du Logement
            </h3>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-paper/60">Unité :</span>
                <span className="text-paper font-bold">{reservationInfo.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-paper/60">Localisation :</span>
                <span className="text-sand">{reservationInfo.block}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-paper/60">Surface :</span>
                <span className="text-paper">{reservationInfo.surface}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-paper/60">Prix Total :</span>
                <span className="text-laterite-light font-bold">{reservationInfo.price}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-paper/60">Acompte Réglé :</span>
                <span className="text-lagoon-light font-bold">{reservationInfo.acomptePaid}</span>
              </div>
            </div>

            <div className="p-3 bg-paper/5 border-l-2 border-sand rounded-r font-mono text-xs text-sand">
              ℹ️ Lot B à 58% des ventes. Plus que 2 réserves avant déblocage officiel du prêt bancaire !
            </div>

            <button className="w-full border border-paper/30 hover:border-sand text-paper font-mono text-xs py-2.5 rounded transition-all flex items-center justify-center gap-2">
              <Download className="w-4 h-4" /> Télécharger Attestation (.PDF)
            </button>
          </div>

          {/* Schedule & Timeline */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-ink-card border border-paper/20 rounded-md p-6">
              <h3 className="font-serif text-xl font-semibold text-paper mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-sand" /> Échéancier des Paiements (XOF)
              </h3>

              <div className="space-y-3 font-mono text-xs">
                {schedule.map((item, sIdx) => (
                  <div
                    key={sIdx}
                    className="p-3.5 bg-paper/5 border border-paper/10 rounded flex justify-between items-center"
                  >
                    <div>
                      <div className="font-bold text-paper text-sm">{item.label}</div>
                      <div className="text-paper/50">Échéance : {item.dueDate}</div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-laterite-light text-sm mb-1">{item.amount}</div>
                      {item.status === 'PAYE' ? (
                        <span className="inline-flex items-center gap-1 text-lagoon-light bg-lagoon/20 px-2 py-0.5 rounded border border-lagoon/40">
                          <CheckCircle2 className="w-3 h-3" /> Réglé
                        </span>
                      ) : (
                        <span className="text-paper/50 bg-paper/10 px-2 py-0.5 rounded border border-paper/20">
                          En attente
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Construction Progress Feed */}
            <div className="bg-ink-card border border-paper/20 rounded-md p-6">
              <h3 className="font-serif text-xl font-semibold text-paper mb-4 flex items-center gap-2">
                <HardHat className="w-5 h-5 text-laterite-light" /> Suivi de Chantier en Direct
              </h3>

              <div className="p-4 bg-paper/5 border border-paper/10 rounded space-y-3">
                <div className="flex justify-between items-center font-mono text-xs text-paper/60">
                  <span>Phase : <b>Fondations & Bornage</b></span>
                  <span>Jalon à venir : <b>Gros Œuvre</b></span>
                </div>
                <div className="w-full bg-paper/10 h-2 rounded-full overflow-hidden">
                  <div className="bg-sand h-full w-[25%]" />
                </div>
                <p className="text-xs text-paper/70 font-mono">
                  Dernière mise à jour par l'architecte : Bornage validé sur le Titre Foncier RM100/71.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
