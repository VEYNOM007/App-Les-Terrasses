'use client';

import React, { useState } from 'react';
import { Calculator, TrendingUp, ShieldCheck, DollarSign, Calendar } from 'lucide-react';

interface FinancialSimulatorProps {
  unitPriceXOF: number;
  estimatedMonthlyRentXOF: number;
  estimatedNetYieldAnnual: number;
}

export default function FinancialSimulator({
  unitPriceXOF,
  estimatedMonthlyRentXOF,
  estimatedNetYieldAnnual,
}: FinancialSimulatorProps) {
  const [mode, setMode] = useState<'schedule' | 'investor'>('schedule');
  const [downPaymentPercent, setDownPaymentPercent] = useState<number>(20); // 20%
  const [holdingYears, setHoldingYears] = useState<number>(5);

  // Financial calculations
  const downPaymentAmount = (unitPriceXOF * downPaymentPercent) / 100;
  const remainingAmount = unitPriceXOF - downPaymentAmount;

  // VEFA Payment Milestones
  const milestoneFondations = unitPriceXOF * 0.3; // 30%
  const milestoneHorsDEau = unitPriceXOF * 0.3; // 30%
  const milestoneLivraison = unitPriceXOF * 0.2; // 20%

  // Investor Yield calculations
  const annualRentTotal = estimatedMonthlyRentXOF * 12;
  const netYieldPercent = ((annualRentTotal * 0.85) / unitPriceXOF) * 100; // 15% charges/management reserve
  const cumulativeRent5Years = annualRentTotal * 5;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('fr-FR').format(Math.round(val)) + ' FCFA';
  };

  return (
    <div className="bg-ink/80 border border-paper/20 rounded-xl p-5 font-sans space-y-5">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-paper/15">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-laterite/20 text-laterite-light border border-laterite/40">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-serif text-lg font-semibold text-paper">Simulateur Financier VEFA</h4>
            <p className="text-xs font-mono text-paper/60">Transparence totale sur votre investissement</p>
          </div>
        </div>

        <div className="flex bg-ink-dark p-1 rounded-lg border border-paper/15 font-mono text-xs">
          <button
            onClick={() => setMode('schedule')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              mode === 'schedule' ? 'bg-laterite text-paper font-bold' : 'text-paper/70 hover:text-paper'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" /> Échéancier Chantier
          </button>
          <button
            onClick={() => setMode('investor')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              mode === 'investor' ? 'bg-lagoon text-paper font-bold' : 'text-paper/70 hover:text-paper'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" /> Rendement Locatif
          </button>
        </div>
      </div>

      {mode === 'schedule' ? (
        <div className="space-y-4 font-mono text-xs">
          <div className="space-y-2">
            <div className="flex justify-between items-center text-paper/80">
              <span>Apport à la réservation : <strong>{downPaymentPercent}%</strong></span>
              <span className="text-laterite-light font-bold">{formatCurrency(downPaymentAmount)}</span>
            </div>
            <input
              type="range"
              min="10"
              max="50"
              step="5"
              value={downPaymentPercent}
              onChange={(e) => setDownPaymentPercent(Number(e.target.value))}
              className="w-full accent-laterite bg-ink-card h-2 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-paper/50">
              <span>10% min</span>
              <span>30% recommandé</span>
              <span>50% max</span>
            </div>
          </div>

          <div className="bg-ink-card p-4 rounded-lg border border-paper/15 space-y-3">
            <h5 className="font-serif text-sm font-semibold text-sand">Échéancier de Financement par Jalons</h5>

            <div className="space-y-2">
              <div className="flex justify-between items-center p-2 rounded bg-ink/60 border border-paper/10">
                <span className="text-paper/80">1. Réservation (Acompte)</span>
                <span className="font-bold text-laterite-light">{formatCurrency(downPaymentAmount)}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-ink/60 border border-paper/10">
                <span className="text-paper/80">2. Fin Fondations (30%)</span>
                <span className="font-bold text-paper">{formatCurrency(milestoneFondations)}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-ink/60 border border-paper/10">
                <span className="text-paper/80">3. Hors d'Eau / Hors d'Air (30%)</span>
                <span className="font-bold text-paper">{formatCurrency(milestoneHorsDEau)}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-ink/60 border border-paper/10">
                <span className="text-paper/80">4. Remise des clés & Titre (20%)</span>
                <span className="font-bold text-lagoon-light">{formatCurrency(milestoneLivraison)}</span>
              </div>
            </div>

            <p className="text-[11px] text-paper/60 italic pt-1">
              * Aucun intérêt bancaire. Paiement direct échelonné selon l'avancement réel certifié du chantier.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4 font-mono text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-ink-card p-3 rounded-lg border border-paper/15 text-center">
              <span className="text-paper/60 text-[11px] block">Loyer Mensuel Estimé</span>
              <span className="text-base font-bold text-sand">{formatCurrency(estimatedMonthlyRentXOF)}</span>
              <span className="text-[10px] text-paper/50 block mt-0.5">Baguida / Littoral</span>
            </div>
            <div className="bg-ink-card p-3 rounded-lg border border-paper/15 text-center">
              <span className="text-paper/60 text-[11px] block">Rendement Net Estimé</span>
              <span className="text-base font-bold text-lagoon-light">{netYieldPercent.toFixed(1)} % / an</span>
              <span className="text-[10px] text-paper/50 block mt-0.5">Après charges</span>
            </div>
            <div className="bg-ink-card p-3 rounded-lg border border-paper/15 text-center">
              <span className="text-paper/60 text-[11px] block">Revenus Locatifs sur 5 ans</span>
              <span className="text-base font-bold text-laterite-light">{formatCurrency(cumulativeRent5Years)}</span>
              <span className="text-[10px] text-paper/50 block mt-0.5">Hors plus-value immobilière</span>
            </div>
          </div>

          <div className="bg-lagoon/10 border border-lagoon/30 p-3.5 rounded-lg flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-lagoon-light shrink-0 mt-0.5" />
            <p className="text-xs text-paper/90 leading-relaxed">
              <strong>Atout Diaspora & Investisseur :</strong> Baguida bénéficie d'une forte demande locative d'expatriés et de cadres en raison de sa proximité avec les plages et le port de Lomé.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
