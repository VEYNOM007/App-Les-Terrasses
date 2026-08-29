'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarClock,
  Loader2,
  AlertCircle,
  Clock,
  User,
  Building2,
  FileText,
  RefreshCw,
  XCircle,
  PenLine,
} from 'lucide-react';
import { useAuth } from '../../../components/AuthProvider';
import SignaturePad from '../../../components/SignaturePad';
import {
  fetchAdminReservations,
  regenerateBuyerContract,
  updateAdminReservationStatus,
  signContract,
  AdminReservation,
} from '../../../lib/api';

const URGENCY_THRESHOLDS = {
  CRITICAL: 4 * 60 * 60 * 1000,
  HIGH: 12 * 60 * 60 * 1000,
  MEDIUM: 24 * 60 * 60 * 1000,
} as const;

type ReservationView = 'en_attente' | 'confirmee';

function urgencyClass(msRemaining: number): string {
  if (msRemaining <= 0) return 'bg-laterite/20 text-laterite-light border-laterite/50';
  if (msRemaining < URGENCY_THRESHOLDS.CRITICAL) return 'text-laterite-light font-semibold';
  if (msRemaining < URGENCY_THRESHOLDS.HIGH) return 'text-sand font-semibold';
  if (msRemaining < URGENCY_THRESHOLDS.MEDIUM) return 'text-sand';
  return 'text-lagoon-light';
}

function formatDuration(ms: number): string {
  const abs = Math.abs(ms);
  const totalMinutes = Math.floor(abs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days > 0) return `${days}j ${remainingHours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
  if (hours > 0) return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
  return `${minutes}m`;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  return `il y a ${formatDuration(diff)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// Palier d'un contrat pour le bouton "Générer le contrat" :
//  - buyerSigned  → Palier 1 : bouton masqué (jamais écraser une signature acheteur).
//  - adminSigned  → Palier 2 : bouton affiché, confirmation explicite requise.
//  - autre        → Palier 3 : bouton affiché, régénération libre.
type ContractPalier = 1 | 2 | 3;

function contractPalier(contract: AdminReservation['contract']): ContractPalier | null {
  if (!contract) return null;
  if (contract.buyerSigned) return 1;
  if (contract.adminSigned) return 2;
  return 3;
}

export default function AdminReservationsPage() {
  const { user } = useAuth();
  const [view, setView] = useState<ReservationView>('confirmee');
  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  // Dialogue de confirmation du Palier 2 (contrat déjà signé par l'admin).
  const [pendingConfirm, setPendingConfirm] = useState<AdminReservation | null>(null);
  const [acting, setActing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  // Annulation d'une réservation confirmée (bouton ligne).
  // `cancelling` bloque l'interface pendant l'appel, `pendingCancel` porte la
  // réservation à annuler (null = aucun dialogue ouvert).
  const [pendingCancel, setPendingCancel] = useState<AdminReservation | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  // Contre-signature admin d'un contrat (Palier 1 : l'acheteur a signé, il
  // reste la signature du promoteur). `pendingSign` porte la réservation dont
  // le contrat est en cours de contre-signature (null = SignaturePad fermé).
  const [pendingSign, setPendingSign] = useState<AdminReservation | null>(null);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollHint = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 1);
  }, []);

  useEffect(() => {
    updateScrollHint();
    window.addEventListener('resize', updateScrollHint);
    return () => window.removeEventListener('resize', updateScrollHint);
  }, [reservations, updateScrollHint]);

  const load = useCallback(async (target: ReservationView) => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminReservations(target);
      setReservations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les réservations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void load(view);
  }, [user, load, view]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const switchView = useCallback(
    (next: ReservationView) => {
      if (next === view) return;
      setView(next);
    },
    [view],
  );

  const sorted = useMemo(() => {
    if (view === 'en_attente') {
      return [...reservations].sort(
        (a, b) => new Date(a.lockExpiresAt).getTime() - new Date(b.lockExpiresAt).getTime(),
      );
    }
    return [...reservations].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [reservations, view]);

  async function runGenerate(reservation: AdminReservation, force: boolean) {
    setActingId(reservation.id);
    setError('');
    try {
      await regenerateBuyerContract(reservation.id, force);
      await load(view);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de générer le contrat.');
    } finally {
      setActingId(null);
      setActing(false);
      setPendingConfirm(null);
    }
  }

  function handleGenerate(reservation: AdminReservation) {
    const palier = contractPalier(reservation.contract);
    if (palier === 2) {
      setActing(true);
      setPendingConfirm(reservation);
      return;
    }
    void runGenerate(reservation, false);
  }

  function confirmPalier2() {
    if (!pendingConfirm) return;
    void runGenerate(pendingConfirm, true);
  }

  // Ouvre le dialogue d'annulation. La confirmation est toujours demandée ;
  // elle est renforcée quand l'acheteur a déjà signé (Palier 1) : annuler
  // laissera le contrat signé en archive annulée.
  function requestCancel(reservation: AdminReservation) {
    setCancelError('');
    setPendingCancel(reservation);
  }

  async function runCancel() {
    if (!pendingCancel) return;
    setCancelling(true);
    setCancelError('');
    try {
      await updateAdminReservationStatus(pendingCancel.id, 'annulee');
      setPendingCancel(null);
      await load(view);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Impossible d'annuler la réservation.");
    } finally {
      setCancelling(false);
    }
  }

  // Ouvre le SignaturePad pour contre-signer le contrat d'une réservation
  // (Palier 1 : l'acheteur a déjà signé, il reste la signature admin).
  function requestSign(reservation: AdminReservation) {
    if (!reservation.contract) return;
    setSignError('');
    setPendingSign(reservation);
  }

  async function runSign(signatureBlob: Blob) {
    if (!pendingSign?.contract) return;
    setSigning(true);
    setSignError('');
    try {
      await signContract(pendingSign.contract.id, signatureBlob);
      setPendingSign(null);
      await load(view);
    } catch (err) {
      setSignError(err instanceof Error ? err.message : 'Impossible de contre-signer le contrat.');
    } finally {
      setSigning(false);
    }
  }

  const isActing = actingId !== null;
  const working = acting || cancelling || isActing || signing;

  if (!user) {
    return (
      <main className="min-h-screen bg-ink text-paper flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="flex items-center gap-3 font-mono text-xs text-paper/60">
            <Loader2 className="w-5 h-5 animate-spin text-laterite-light" /> Vérification de votre
            session…
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ink text-paper flex flex-col">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-paper/15">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-mono tracking-widest text-sand uppercase mb-1">
              <CalendarClock className="w-4 h-4 text-laterite-light" />
              Back-Office Réservations
            </div>
            <h1 className="font-serif text-3xl font-semibold text-paper">
              {view === 'en_attente' ? 'Réservations en attente' : 'Réservations confirmées'}
            </h1>
            <p className="text-xs text-paper/60 font-mono mt-1">
              {view === 'en_attente'
                ? 'Unités verrouillées — annulation automatique après 48h si aucun acompte reçu.'
                : 'Acompte reçu — génération et suivi des contrats de vente.'}
            </p>
          </div>
          <div className="inline-flex rounded-md border border-paper/15 overflow-hidden font-mono text-xs">
            <button
              type="button"
              onClick={() => switchView('confirmee')}
              className={`px-4 py-2 transition-colors ${
                view === 'confirmee'
                  ? 'bg-laterite-light text-ink'
                  : 'text-paper/60 hover:text-paper'
              }`}
            >
              Confirmées
            </button>
            <button
              type="button"
              onClick={() => switchView('en_attente')}
              className={`px-4 py-2 transition-colors ${
                view === 'en_attente'
                  ? 'bg-laterite-light text-ink'
                  : 'text-paper/60 hover:text-paper'
              }`}
            >
              En attente
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-laterite/15 border border-laterite/40 rounded-md p-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-laterite-light shrink-0" />
            <div>
              <p className="text-sm text-paper font-mono">{error}</p>
              <button
                onClick={() => void load(view)}
                className="mt-3 bg-paper/10 hover:bg-paper/20 text-paper font-mono text-xs px-4 py-2 rounded transition-all"
              >
                Réessayer
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-3 font-mono text-xs text-paper/60 py-16">
            <Loader2 className="w-5 h-5 animate-spin text-laterite-light" /> Chargement des
            réservations…
          </div>
        ) : sorted.length === 0 ? (
          <div className="bg-ink-card border border-paper/20 rounded-md p-10 text-center space-y-4">
            <div className="w-14 h-14 bg-lagoon/15 text-lagoon-light rounded-full flex items-center justify-center mx-auto border border-lagoon/40">
              <CalendarClock className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-xl font-semibold text-paper">
              {view === 'en_attente' ? 'Aucune réservation en attente' : 'Aucune réservation confirmée'}
            </h3>
            <p className="text-xs text-paper/60 font-mono max-w-md mx-auto">
              {view === 'en_attente'
                ? 'Toutes les unités sont disponibles ou déjà réservées.'
                : 'Les réservations confirmées (acompte reçu) apparaîtront ici.'}
            </p>
          </div>
        ) : (
          <div className="bg-ink-card border border-paper/20 rounded-md overflow-hidden">
            <div className="relative">
              <div ref={scrollRef} onScroll={updateScrollHint} className="overflow-x-auto">
                <table className="w-full font-mono text-xs">
                  <thead>
                    <tr className="border-b border-paper/15 text-paper/50">
                      <th className="text-left px-5 py-3 font-semibold whitespace-nowrap">
                        Réservation
                      </th>
                      <th className="text-left px-5 py-3 font-semibold whitespace-nowrap">Unité</th>
                      <th className="text-left px-5 py-3 font-semibold whitespace-nowrap">
                        Acheteur
                      </th>
                      {view === 'en_attente' ? (
                        <th className="text-left px-5 py-3 font-semibold whitespace-nowrap">
                          Créée
                        </th>
                      ) : (
                        <>
                          <th className="text-left px-5 py-3 font-semibold whitespace-nowrap">
                            Confirmée
                          </th>
                          <th className="text-left px-5 py-3 font-semibold whitespace-nowrap">
                            Contrat
                          </th>
                        </>
                      )}
                      {view === 'en_attente' && (
                        <th className="text-left px-5 py-3 font-semibold whitespace-nowrap">
                          Expiration
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((r) => {
                      const palier = contractPalier(r.contract);
                      const pasSigneParAcheteur = !r.contract?.buyerSigned;

                      return (
                        <tr
                          key={r.id}
                          className="border-b border-paper/10 hover:bg-paper/5 transition-colors"
                        >
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="bg-lagoon/20 text-lagoon-light border border-lagoon/40 px-2.5 py-1 rounded">
                              {r.id.slice(0, 18)}…
                            </span>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-3.5 h-3.5 text-sand shrink-0" />
                              <span className="text-paper">
                                {r.unit.type} — Étage {r.unit.floor}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-paper/40 shrink-0" />
                              <div>
                                <div className="text-paper">{r.user.fullName}</div>
                                <div className="text-paper/40 text-[11px]">{r.user.email}</div>
                              </div>
                            </div>
                          </td>
                          {view === 'en_attente' ? (
                            <>
                              <td className="px-5 py-4 text-paper/60 whitespace-nowrap">
                                {formatRelative(r.createdAt)}
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap">
                                {new Date(r.lockExpiresAt).getTime() - now <= 0 ? (
                                  <span className="inline-flex items-center gap-1.5 bg-laterite/20 text-laterite-light border border-laterite/50 px-2.5 py-1 rounded">
                                    <Clock className="w-3 h-3" />
                                    Expiration en cours
                                  </span>
                                ) : (
                                  <span
                                    className={`inline-flex items-center gap-1.5 ${urgencyClass(
                                      new Date(r.lockExpiresAt).getTime() - now,
                                    )}`}
                                  >
                                    <Clock className="w-3 h-3" />
                                    dans {formatDuration(new Date(r.lockExpiresAt).getTime() - now)}
                                  </span>
                                )}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-5 py-4 text-paper/60 whitespace-nowrap">
                                {formatDate(r.createdAt)}
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-3">
                                  {palier === 1 ? (
                                    <>
                                      <span className="inline-flex items-center gap-1.5 bg-lagoon/15 text-lagoon-light border border-lagoon/40 px-2.5 py-1 rounded whitespace-nowrap">
                                        <FileText className="w-3 h-3" />
                                        Signé par l'acheteur
                                      </span>
                                      <button
                                        type="button"
                                        disabled={working}
                                        onClick={() => requestSign(r)}
                                        className="inline-flex items-center gap-1.5 bg-lagoon-light/15 border border-lagoon-light/50 text-lagoon-light hover:bg-lagoon-light/25 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded transition-all whitespace-nowrap"
                                      >
                                        <PenLine className="w-3.5 h-3.5" />
                                        Contre-signer
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-paper/50 whitespace-nowrap">
                                        {r.contract
                                          ? r.contract.adminSigned
                                            ? 'Signé admin'
                                            : 'Non signé'
                                          : 'Aucun'}
                                      </span>
                                      <button
                                        type="button"
                                        disabled={acting || !pasSigneParAcheteur}
                                        onClick={() => handleGenerate(r)}
                                        className="inline-flex items-center gap-1.5 bg-laterite-light/15 border border-laterite-light/50 text-laterite-light hover:bg-laterite-light/25 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded transition-all whitespace-nowrap"
                                      >
                                        {actingId === r.id ? (
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <RefreshCw className="w-3.5 h-3.5" />
                                        )}
                                        {palier === 2 ? 'Remplacer le contrat' : 'Générer le contrat'}
                                      </button>
                                    </>
                                  )}
                                  <button
                                    type="button"
                                    disabled={working}
                                    onClick={() => requestCancel(r)}
                                    className="inline-flex items-center gap-1.5 bg-laterite-light/10 border border-laterite-light/40 text-laterite-light hover:bg-laterite-light/20 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded transition-all whitespace-nowrap"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    Annuler
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {canScrollRight && (
                <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-ink-card via-ink-card/60 to-transparent pointer-events-none" />
              )}
            </div>
            <div className="px-5 py-3 border-t border-paper/10 text-paper/40 font-mono text-[11px]">
              {sorted.length} réservation{sorted.length > 1 ? 's' : ''} —{' '}
              {view === 'en_attente' ? 'trié par urgence croissante' : 'trié par date de confirmation'}
            </div>
          </div>
        )}
      </div>

      {pendingConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm"
        >
          <div className="bg-ink-card border border-laterite/40 rounded-md max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-laterite-light shrink-0" />
              <div>
                <h3 className="font-serif text-lg font-semibold text-paper">
                  Remplacer le contrat ?
                </h3>
                <p className="text-xs text-paper/70 font-mono mt-1 leading-relaxed">
                  Ce contrat est déjà signé par l'administration mais pas encore par l'acheteur.
                  Le remplacer supprimera le contrat signé actuel : l'acheteur devra re-signer.
                  Cette action est irréversible.
                </p>
                <p className="text-xs text-paper/50 font-mono mt-2">
                  {pendingConfirm.user.fullName} — {pendingConfirm.unit.type}, Étage{' '}
                  {pendingConfirm.unit.floor}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={acting}
                onClick={() => {
                  setPendingConfirm(null);
                  setActing(false);
                }}
                className="bg-paper/10 hover:bg-paper/20 text-paper font-mono text-xs px-4 py-2 rounded transition-all disabled:opacity-40"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={acting}
                onClick={confirmPalier2}
                className="bg-laterite-light text-ink hover:bg-laterite-light/90 font-mono text-xs px-4 py-2 rounded transition-all disabled:opacity-40"
              >
                {acting ? 'Remplacement…' : 'Confirmer le remplacement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingCancel && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm"
        >
          <div className="bg-ink-card border border-laterite/40 rounded-md max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-laterite-light shrink-0" />
              <div>
                <h3 className="font-serif text-lg font-semibold text-paper">
                  Annuler cette réservation ?
                </h3>
                {pendingCancel.contract?.buyerSigned ? (
                  <p className="text-xs text-paper/70 font-mono mt-1 leading-relaxed">
                    L'acheteur a déjà signé le contrat de vente. Annuler la réservation
                    libérera l'unité mais laissera le contrat signé en archive annulée
                    (il restera visible côté acheteur dans son suivi). Cette action est
                    irréversible.
                  </p>
                ) : (
                  <p className="text-xs text-paper/70 font-mono mt-1 leading-relaxed">
                    La réservation sera annulée et l'unité redeviendra disponible.
                    Cette action est irréversible.
                  </p>
                )}
                <p className="text-xs text-paper/50 font-mono mt-2">
                  {pendingCancel.user.fullName} — {pendingCancel.unit.type}, Étage{' '}
                  {pendingCancel.unit.floor}
                </p>
                {cancelError && (
                  <p className="text-xs font-mono text-laterite-light mt-2">
                    {cancelError}
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={cancelling}
                onClick={() => {
                  setPendingCancel(null);
                  setCancelError('');
                }}
                className="bg-paper/10 hover:bg-paper/20 text-paper font-mono text-xs px-4 py-2 rounded transition-all disabled:opacity-40"
              >
                Fermer
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={() => void runCancel()}
                className="bg-laterite-light text-ink hover:bg-laterite-light/90 font-mono text-xs px-4 py-2 rounded transition-all disabled:opacity-40"
              >
                {cancelling ? 'Annulation…' : pendingCancel.contract?.buyerSigned
                  ? 'Confirmer l\'annulation'
                  : 'Annuler la réservation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingSign && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm"
        >
          <div className="bg-ink-card border border-lagoon/40 rounded-md max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-serif text-lg font-semibold text-paper">
                  Contre-signer le contrat
                </h3>
                <p className="text-xs text-paper/60 font-mono mt-1">
                  {pendingSign.user.fullName} — {pendingSign.unit.type}, Étage{' '}
                  {pendingSign.unit.floor}
                </p>
                <p className="text-xs text-paper/50 font-mono mt-1">
                  L'acheteur a déjà signé ; votre signature de promoteur finalisera
                  le contrat et sera embarquée sur le PDF.
                </p>
              </div>
            </div>
            {signError && (
              <p className="text-xs font-mono text-laterite-light bg-laterite/10 border border-laterite/30 rounded px-3 py-2">
                {signError}
              </p>
            )}
            <SignaturePad
              onConfirm={(blob) => void runSign(blob)}
              onCancel={() => {
                setPendingSign(null);
                setSignError('');
              }}
            />
          </div>
        </div>
      )}
    </main>
  );
}
