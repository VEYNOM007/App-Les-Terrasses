'use client';

import React, { useEffect, useState } from 'react';
import { X, ShieldCheck, CheckCircle, Loader2, AlertTriangle, LogIn, ArrowRight } from 'lucide-react';
import { createReservation, fetchUnit, ReservationResponse } from '../lib/api';
import { buildUnitDetailView, UnitDetailView } from '../lib/catalog/unit-detail';
import { useAuth } from './AuthProvider';

interface ReservationModalProps {
  isOpen: boolean;
  unitId: string | null;
  onClose: () => void;
}

export default function ReservationModal({ isOpen, unitId, onClose }: ReservationModalProps) {
  const { user } = useAuth();
  const [unit, setUnit] = useState<UnitDetailView | null>(null);
  const [unitLoading, setUnitLoading] = useState(false);
  const [unitError, setUnitError] = useState<string | null>(null);
  const [step, setStep] = useState<'FORM' | 'LOADING' | 'CONFIRMED' | 'ERROR'>('FORM');
  const [reservation, setReservation] = useState<ReservationResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Chargement de l'unité réelle sélectionnée (source de vérité : API).
  useEffect(() => {
    if (!isOpen || !unitId) return;
    let cancelled = false;
    setUnitLoading(true);
    setUnitError(null);
    fetchUnit(unitId)
      .then((data) => {
        if (!cancelled) setUnit(buildUnitDetailView(data));
      })
      .catch((e) => {
        if (!cancelled) {
          setUnitError(e instanceof Error ? e.message : 'Impossible de charger l\'unité.');
        }
      })
      .finally(() => {
        if (!cancelled) setUnitLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, unitId]);

  // Reset à la fermeture / changement d'unité
  useEffect(() => {
    if (!isOpen) {
      setStep('FORM');
      setReservation(null);
      setErrorMessage('');
    }
  }, [isOpen]);

  // Timer réel basé sur le lockExpiresAt renvoyé par l'API
  const [timerSeconds, setTimerSeconds] = useState(0);
  useEffect(() => {
    if (!isOpen || step !== 'CONFIRMED' || !reservation?.lockExpiresAt) return;

    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor(
        (new Date(reservation.lockExpiresAt).getTime() - Date.now()) / 1000
      ));
      setTimerSeconds(remaining);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isOpen, step, reservation]);

  if (!isOpen) return null;

  const formatTimer = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitId || !user) return;
    setStep('LOADING');
    setErrorMessage('');

    try {
      const result = await createReservation(unitId);
      setReservation(result);
      setStep('CONFIRMED');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue lors de la réservation.';
      setErrorMessage(message);
      setStep('ERROR');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-ink-card border border-paper/30 rounded-lg max-w-xl w-full p-6 sm:p-8 relative shadow-2xl my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-paper/60 hover:text-paper p-2 rounded-full hover:bg-paper/10"
        >
          <X className="w-5 h-5" />
        </button>

        {step === 'FORM' && !unitId ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-12 h-12 bg-laterite/20 text-laterite-light rounded-full flex items-center justify-center mx-auto border border-laterite/40">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="font-serif text-2xl font-semibold text-paper">
              Unité requise
            </h2>
            <p className="text-sm text-paper/80 font-mono">
              La réservation verrouille une unité précise. Sélectionnez un bien
              dans le catalogue pour démarrer la réservation.
            </p>
            <a
              href="/catalogue"
              className="inline-flex items-center gap-2 bg-laterite hover:bg-laterite-light text-paper font-mono text-xs px-6 py-3 rounded-lg transition-all"
            >
              Voir le catalogue <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        ) : step === 'FORM' && !user ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-12 h-12 bg-laterite/20 text-laterite-light rounded-full flex items-center justify-center mx-auto border border-laterite/40">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="font-serif text-2xl font-semibold text-paper">
              Connexion requise
            </h2>
            <p className="text-sm text-paper/80 font-mono">
              Le verrouillage d'une unité nécessite un compte acheteur vérifié.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <a
                href="/login"
                className="bg-laterite hover:bg-laterite-light text-paper font-mono text-xs px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                <LogIn className="w-4 h-4" /> Se connecter
              </a>
              <a
                href="/register"
                className="border border-paper/20 hover:border-sand text-paper font-mono text-xs px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                Créer un compte
              </a>
            </div>
          </div>
        ) : step === 'FORM' ? (
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-sand mb-1">
              <ShieldCheck className="w-4 h-4 text-laterite-light" />
              <span>VERROU REDIS 48H — RÉSERVATION AUTHENTIFIÉE</span>
            </div>

            <h2 className="font-serif text-2xl font-semibold text-paper mb-2">
              Réserver votre logement sur plan
            </h2>
            <p className="text-xs text-paper/70 font-mono mb-6">
              La confirmation crée le verrou 48h via l'API (POST /v1/reservations).
            </p>

            {unitLoading && (
              <div className="flex items-center justify-center gap-2 py-6 text-paper/60 font-mono text-xs">
                <Loader2 className="w-4 h-4 animate-spin" /> Chargement de l'unité…
              </div>
            )}

            {unitError && (
              <div className="bg-laterite/10 border border-laterite/30 text-paper/80 p-4 rounded font-mono text-xs mb-4">
                {unitError}
              </div>
            )}

            {!unitLoading && unit && (
              <>
                <div className="bg-paper/5 border border-paper/20 rounded p-4 mb-6 font-mono text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-paper/60">Bien</span>
                    <span className="text-paper font-bold">{unit.typeLabel} · Étage {unit.floor}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-paper/60">Bloc</span>
                    <span className="text-sand font-bold">{unit.blockName} · {unit.blockFrontage}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-paper/60">Surface</span>
                    <span className="text-paper font-bold">{unit.surfaceM2} m²</span>
                  </div>
                  <div className="flex justify-between border-t border-paper/15 pt-2">
                    <span className="text-paper/60">Prix du bien</span>
                    <span className="text-laterite-light font-bold">{unit.priceFormatted}</span>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <button
                    type="submit"
                    disabled={!unit.canReserve}
                    className="w-full bg-laterite hover:bg-laterite-light disabled:opacity-40 disabled:cursor-not-allowed text-paper font-mono text-xs py-3.5 rounded transition-all mt-4 font-semibold"
                  >
                    {unit.canReserve ? 'Confirmer le verrouillage 48h →' : `${unit.statusLabel} — indisponible à la réservation`}
                  </button>
                </form>
              </>
            )}
          </div>
        ) : step === 'LOADING' ? (
          <div className="text-center py-12 space-y-4">
            <div className="w-12 h-12 bg-laterite/20 text-laterite-light rounded-full flex items-center justify-center mx-auto border border-laterite/40 animate-pulse">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <h3 className="font-serif text-xl font-semibold text-paper">
              Verrouillage en cours…
            </h3>
            <p className="text-xs text-paper/60 font-mono">
              Acquisition du verrou Redis sur l'unité sélectionnée.<br />
              Transaction atomique en cours de traitement.
            </p>
          </div>
        ) : step === 'ERROR' ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-12 h-12 bg-laterite/20 text-laterite-light rounded-full flex items-center justify-center mx-auto border border-laterite/40">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-xl font-semibold text-paper">
              Réservation impossible
            </h3>
            <p className="text-sm text-paper/80 font-mono">
              {errorMessage}
            </p>
            <button
              onClick={() => setStep('FORM')}
              className="bg-laterite hover:bg-laterite-light text-paper font-mono text-xs px-6 py-2.5 rounded transition-all"
            >
              ← Réessayer
            </button>
          </div>
        ) : (
          <div className="text-center py-6 space-y-4">
            <div className="w-12 h-12 bg-lagoon/20 text-lagoon-light rounded-full flex items-center justify-center mx-auto border border-lagoon/40">
              <CheckCircle className="w-6 h-6" />
            </div>

            <h3 className="font-serif text-2xl font-semibold text-paper">
              Réservation Verrouillée avec Succès !
            </h3>

            {unit && (
              <p className="text-sm text-paper/80 font-mono">
                Un verrou a été créé sur le <b className="text-sand">{unit.typeLabel}</b> du <b className="text-sand">{unit.blockName}</b> (étage {unit.floor}).
              </p>
            )}

            <div className="bg-paper/5 border border-paper/20 p-4 rounded text-left font-mono text-xs space-y-2">
              {reservation?.id && (
                <div className="flex justify-between">
                  <span className="text-paper/60">Réf. réservation :</span>
                  <span className="text-lagoon-light font-bold">{reservation.id.substring(0, 12)}…</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-paper/60">Statut :</span>
                <span className="text-lagoon-light font-bold">{reservation?.status ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-paper/60">Expiration du verrou :</span>
                <span className="text-laterite-light font-bold">
                  {reservation?.lockExpiresAt
                    ? new Date(reservation.lockExpiresAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
                    : '—'}
                </span>
              </div>
              {step === 'CONFIRMED' && reservation?.lockExpiresAt && (
                <div className="flex justify-between">
                  <span className="text-paper/60">Compte à rebours :</span>
                  <span className="text-laterite-light font-bold">{formatTimer(timerSeconds)}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-paper/60">
              Vous allez être contacté sous 24h pour la finalisation de votre contrat d'acompte.
            </p>

            <button
              onClick={() => {
                setStep('FORM');
                onClose();
              }}
              className="bg-paper/10 hover:bg-paper/20 text-paper font-mono text-xs px-6 py-2.5 rounded transition-all"
            >
              Fermer la fenêtre
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
