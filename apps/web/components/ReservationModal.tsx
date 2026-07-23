'use client';

import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Clock, CreditCard, Smartphone, CheckCircle, Car, Loader2, AlertTriangle } from 'lucide-react';
import { UnitTypology } from './CatalogGrid';
import { createReservation, ReservationResponse } from '../lib/api';

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTypology?: UnitTypology | null;
}

export default function ReservationModal({ isOpen, onClose, selectedTypology }: ReservationModalProps) {
  const [selectedBlock, setSelectedBlock] = useState<string>('Bloc A');
  const [selectedType, setSelectedType] = useState<string>('T2');
  const [parkingOption, setParkingOption] = useState<string>('SOUS_PILOTIS');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [paymentProvider, setPaymentProvider] = useState<'CINETPAY' | 'STRIPE'>('CINETPAY');
  const [step, setStep] = useState<'FORM' | 'LOADING' | 'CONFIRMED' | 'ERROR'>('FORM');
  const [timerSeconds, setTimerSeconds] = useState(172800); // 48h in seconds
  const [reservation, setReservation] = useState<ReservationResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (selectedTypology) {
      setSelectedType(selectedTypology.type);
    }
  }, [selectedTypology]);

  // Timer basé sur lockExpiresAt réel ou fallback 48h
  useEffect(() => {
    if (!isOpen) return;

    if (reservation?.lockExpiresAt) {
      const updateTimer = () => {
        const remaining = Math.max(0, Math.floor(
          (new Date(reservation.lockExpiresAt).getTime() - Date.now()) / 1000
        ));
        setTimerSeconds(remaining);
      };
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }

    const interval = setInterval(() => {
      setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, reservation]);

  // Reset à la fermeture
  useEffect(() => {
    if (!isOpen) {
      setStep('FORM');
      setReservation(null);
      setErrorMessage('');
      setTimerSeconds(172800);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatTimer = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep('LOADING');
    setErrorMessage('');

    try {
      // Récupérer le token JWT depuis le localStorage (défini lors du login)
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

      if (token) {
        // Mode connecté : appel API réel
        const unitId = `unit-${selectedBlock.replace(/\s/g, '-').toLowerCase()}-${selectedType.toLowerCase()}`;
        const result = await createReservation(unitId, token);
        setReservation(result);
      } else {
        // Mode démo : simulation de réservation (pas de backend)
        await new Promise((resolve) => setTimeout(resolve, 1200));
        setReservation({
          id: `demo-res-${Date.now()}`,
          unitId: 'demo-unit',
          userId: 'demo-user',
          status: 'EN_ATTENTE',
          lockExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
        });
      }

      setStep('CONFIRMED');
    } catch (err: any) {
      setErrorMessage(err.message || 'Une erreur est survenue lors de la réservation.');
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

        {step === 'FORM' ? (
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-sand mb-1">
              <Clock className="w-4 h-4 text-laterite-light" />
              <span>GARANTIE DE VERROUILLAGE REDIS (48h)</span>
            </div>

            <h2 className="font-serif text-2xl font-semibold text-paper mb-2">
              Réserver votre logement sur plan
            </h2>
            <p className="text-xs text-paper/70 font-mono mb-6">
              Votre réservation bloque l'unité pendant 48 heures sans risque d'annulation durant la fenêtre.
            </p>

            {/* Hold Timer Banner */}
            <div className="bg-laterite/15 border border-laterite/40 rounded p-3 mb-6 flex justify-between items-center font-mono text-xs">
              <span className="text-paper/80">Temps de blocage restant :</span>
              <span className="text-laterite-light font-bold text-sm">{formatTimer(timerSeconds)}</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-xs text-paper/60 uppercase mb-1">Bloc désiré</label>
                  <select
                    value={selectedBlock}
                    onChange={(e) => setSelectedBlock(e.target.value)}
                    className="w-full bg-paper/5 border border-paper/20 rounded p-2.5 text-sm text-paper font-sans focus:border-laterite-light outline-none"
                  >
                    <option value="Bloc A">Bloc A (Sud-Ouest)</option>
                    <option value="Bloc B">Bloc B (Sud-Est)</option>
                    <option value="Bloc C">Bloc C (Nord-Ouest)</option>
                    <option value="Bloc D">Bloc D (Nord-Est)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-xs text-paper/60 uppercase mb-1">Typologie</label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="w-full bg-paper/5 border border-paper/20 rounded p-2.5 text-sm text-paper font-sans focus:border-laterite-light outline-none"
                  >
                    <option value="STUDIO">Studio (≈25 m²)</option>
                    <option value="T2">Appartement T2 (≈45 m²)</option>
                    <option value="T3">Appartement T3 (≈65 m²)</option>
                    <option value="T5">Appartement T5 (≈100 m²)</option>
                    <option value="COMMERCE">Local Commercial</option>
                  </select>
                </div>
              </div>

              {/* Parking Option Selector */}
              <div>
                <label className="block font-mono text-xs text-paper/60 uppercase mb-1 flex items-center gap-1">
                  <Car className="w-3.5 h-3.5 text-sand" /> Option Parking
                </label>
                <select
                  value={parkingOption}
                  onChange={(e) => setParkingOption(e.target.value)}
                  className="w-full bg-paper/5 border border-paper/20 rounded p-2.5 text-sm text-paper font-sans focus:border-laterite-light outline-none"
                >
                  <option value="SOUS_PILOTIS">Parking Sous Pilotis (Résident RDC - Inclus)</option>
                  <option value="AUVENT_SOLAIRE">Auvent Solaire ☀ (Ombrage + Panneaux solaires)</option>
                  <option value="AUVENT_CLASSIQUE">Auvent Classique (Appoint)</option>
                </select>
              </div>

              <div>
                <label className="block font-mono text-xs text-paper/60 uppercase mb-1">Nom complet *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Akossiwa Mensah"
                  className="w-full bg-paper/5 border border-paper/20 rounded p-2.5 text-sm text-paper font-sans focus:border-laterite-light outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-xs text-paper/60 uppercase mb-1">Numéro WhatsApp *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+228 90 00 00 00"
                    className="w-full bg-paper/5 border border-paper/20 rounded p-2.5 text-sm text-paper font-sans focus:border-laterite-light outline-none"
                  />
                </div>

                <div>
                  <label className="block font-mono text-xs text-paper/60 uppercase mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.com"
                    className="w-full bg-paper/5 border border-paper/20 rounded p-2.5 text-sm text-paper font-sans focus:border-laterite-light outline-none"
                  />
                </div>
              </div>

              {/* Payment Provider Selection */}
              <div>
                <label className="block font-mono text-xs text-paper/60 uppercase mb-2">Mode d'acompte préféré</label>
                <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => setPaymentProvider('CINETPAY')}
                    className={`p-3 border rounded flex items-center gap-2 justify-center transition-all ${
                      paymentProvider === 'CINETPAY'
                        ? 'border-laterite bg-laterite/20 text-paper font-bold'
                        : 'border-paper/20 text-paper/70 hover:border-paper/40'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 text-lagoon-light" /> Mobile Money (CinetPay)
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentProvider('STRIPE')}
                    className={`p-3 border rounded flex items-center gap-2 justify-center transition-all ${
                      paymentProvider === 'STRIPE'
                        ? 'border-laterite bg-laterite/20 text-paper font-bold'
                        : 'border-paper/20 text-paper/70 hover:border-paper/40'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-sand" /> Carte Bancaire (Stripe)
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-laterite hover:bg-laterite-light text-paper font-mono text-xs py-3.5 rounded transition-all mt-4 font-semibold"
              >
                Confirmer le verrouillage 48h →
              </button>
            </form>
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

            <p className="text-sm text-paper/80 font-mono">
              Un verrou Redis a été créé sur l'unité <b className="text-sand">{selectedType}</b> du <b className="text-sand">{selectedBlock}</b>.
            </p>

            <div className="bg-paper/5 border border-paper/20 p-4 rounded text-left font-mono text-xs space-y-2">
              {reservation?.id && (
                <div className="flex justify-between">
                  <span className="text-paper/60">Réf. réservation :</span>
                  <span className="text-lagoon-light font-bold">{reservation.id.substring(0, 12)}…</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-paper/60">Réservant :</span>
                <span className="text-paper font-bold">{fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-paper/60">WhatsApp :</span>
                <span className="text-paper font-bold">{phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-paper/60">Mode de paiement :</span>
                <span className="text-sand font-bold">{paymentProvider === 'CINETPAY' ? 'CinetPay Mobile Money' : 'Stripe Card'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-paper/60">Expiration du verrou :</span>
                <span className="text-laterite-light font-bold">
                  {reservation?.lockExpiresAt
                    ? new Date(reservation.lockExpiresAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
                    : 'Dans 48 heures'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-paper/60">Statut :</span>
                <span className="text-lagoon-light font-bold">{reservation?.status || 'EN_ATTENTE'}</span>
              </div>
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
