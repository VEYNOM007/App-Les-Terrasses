'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Calculator, Calendar, Loader2, RefreshCw } from 'lucide-react';
import { fetchPaymentPreview, PaymentPreview } from '../../lib/api';
import { formatXOF, toNumber } from '../../lib/catalog/catalogue-grid';

interface FinancialSimulatorProps {
  unitId: string;
}

const DEBOUNCE_MS = 400;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Échéancier piloté par GET /catalog/units/:id/payment-preview (source de
 * vérité : buildInstallmentPlan côté API). Aucun pourcentage hardcodé ici.
 * Le mode investisseur (loyer/rendement) est absent tant que le modèle de
 * données n'expose pas ces champs.
 */
export default function FinancialSimulator({ unitId }: FinancialSimulatorProps) {
  const [preview, setPreview] = useState<PaymentPreview | null>(null);
  const [downPaymentPercent, setDownPaymentPercent] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (percent?: number) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchPaymentPreview(unitId, percent);
        setPreview(result);
        setDownPaymentPercent((current) => current ?? result.downPaymentPercent);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Impossible de calculer l\'échéancier.');
      } finally {
        setLoading(false);
      }
    },
    [unitId],
  );

  // Chargement initial : l'API applique l'acompte par défaut du projet.
  useEffect(() => {
    setDownPaymentPercent(null);
    void load();
    return () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    };
  }, [load]);

  const handlePercentChange = (value: number) => {
    setDownPaymentPercent(value);
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void load(value), DEBOUNCE_MS);
  };

  const totalAmount = preview ? toNumber(preview.totalAmount) : 0;
  const downPaymentAmount = preview ? Math.round(totalAmount * (downPaymentPercent ?? 0) / 100) : 0;

  return (
    <div className="bg-ink/80 border border-paper/20 rounded-xl p-5 font-sans space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-paper/15">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-laterite/20 text-laterite-light border border-laterite/40">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-serif text-lg font-semibold text-paper">Simulateur Financier VEFA</h4>
            <p className="text-xs font-mono text-paper/60">Échéancier réel du projet — acompte + tranches de chantier</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-laterite/10 border border-laterite/30 p-4 rounded-lg flex items-center justify-between gap-3 font-mono text-xs">
          <span className="text-paper/80">{error}</span>
          <button
            onClick={() => void load(downPaymentPercent ?? undefined)}
            className="bg-paper/10 hover:bg-paper/20 text-paper px-3 py-1.5 rounded flex items-center gap-1.5 shrink-0 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Réessayer
          </button>
        </div>
      )}

      {loading && !preview && (
        <div className="flex items-center justify-center gap-2 py-8 text-paper/60 font-mono text-xs">
          <Loader2 className="w-4 h-4 animate-spin" /> Calcul de l'échéancier…
        </div>
      )}

      {preview && (
        <div className="space-y-4 font-mono text-xs">
          <div className="space-y-2">
            <div className="flex justify-between items-center text-paper/80">
              <span>Apport à la réservation : <strong>{downPaymentPercent ?? preview.downPaymentPercent}%</strong></span>
              <span className="text-laterite-light font-bold">{formatXOF(downPaymentAmount)}</span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={downPaymentPercent ?? preview.downPaymentPercent}
              onChange={(e) => handlePercentChange(Number(e.target.value))}
              className="w-full accent-laterite bg-ink-card h-2 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-paper/50">
              <span>1%</span>
              <span>10% par défaut</span>
              <span>100%</span>
            </div>
          </div>

          <div className="bg-ink-card p-4 rounded-lg border border-paper/15 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h5 className="font-serif text-sm font-semibold text-sand flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Échéancier de Financement
              </h5>
              {loading && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-laterite-light">
                  <Loader2 className="w-3 h-3 animate-spin" /> Recalcul en cours…
                </span>
              )}
            </div>

            <div className={`space-y-1.5 transition-opacity duration-200 ${loading ? 'opacity-50' : 'opacity-100'}`}>
              {preview.installments.map((inst, i) => (
                <div key={i} className="flex justify-between items-center p-2 rounded bg-ink/60 border border-paper/10">
                  <div>
                    <span className="text-paper/80">{inst.label}</span>
                    <span className="block text-[10px] text-paper/50">{formatDate(inst.dueDate)}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-paper">{formatXOF(toNumber(inst.amount))}</span>
                    <span className="block text-[10px] text-paper/50">{Math.round(inst.percent * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-paper/10 font-bold">
              <span className="text-paper">Total du bien</span>
              <span className="text-laterite-light text-sm">{formatXOF(totalAmount)}</span>
            </div>
          </div>

          <p className="text-[11px] text-paper/60 italic pt-1">
            * Aucun intérêt bancaire. Paiement direct échelonné selon l'avancement réel certifié du chantier.
          </p>
        </div>
      )}
    </div>
  );
}
