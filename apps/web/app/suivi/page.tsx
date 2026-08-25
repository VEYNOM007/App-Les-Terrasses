'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  HardHat,
  ShieldCheck,
  Download,
  AlertCircle,
  Loader2,
  Home,
  FileText,
  PenLine,
  Sparkles,
  ExternalLink,
  CreditCard,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../components/AuthProvider';
import SignaturePad from '../../components/SignaturePad';
import {
  fetchPortalDashboard,
  fetchPortalDocuments,
  downloadDocument,
  signContract,
  fetchPaymentSchedule,
  payInstallment,
  cancelReservation,
  PortalDashboard,
  PortalDocument,
  PaymentScheduleResponse,
} from '../../lib/api';

function formatXOF(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat('fr-FR').format(Number.isFinite(n) ? n : 0);
}

function reservationStatusLabel(status: string): string {
  switch (status) {
    case 'EN_ATTENTE':
      return 'En attente de validation';
    case 'CONFIRMEE':
      return 'Confirmée';
    case 'ANNULEE':
      return 'Annulée';
    case 'LIVREE':
      return 'Livrée';
    default:
      return status;
  }
}

function installmentStatusLabel(status: string): string {
  switch (status) {
    case 'PAYE':
      return 'Réglé';
    case 'EN_ATTENTE':
      return 'En attente';
    default:
      return status;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function SuiviAcquereur() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [dashboards, setDashboards] = useState<PortalDashboard[]>([]);
  const [error, setError] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState('');
  const [signingDocumentId, setSigningDocumentId] = useState<string | null>(null);
  const [signingError, setSigningError] = useState('');

  const [schedulesMap, setSchedulesMap] = useState<Record<string, PaymentScheduleResponse>>({});
  const [scheduleLoadingMap, setScheduleLoadingMap] = useState<Record<string, boolean>>({});
  const [scheduleErrorMap, setScheduleErrorMap] = useState<Record<string, string>>({});

  const [payingInstallmentId, setPayingInstallmentId] = useState<string | null>(null);
  const [paymentErrorMap, setPaymentErrorMap] = useState<Record<string, string>>({});

  const [cancellingReservationId, setCancellingReservationId] = useState<string | null>(null);
  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null);
  const [cancelErrorMap, setCancelErrorMap] = useState<Record<string, string>>({});

  const [showHistory, setShowHistory] = useState(false);

  const activeReservations = useMemo(
    () => dashboards.filter((d) => ['EN_ATTENTE', 'CONFIRMEE', 'LIVREE'].includes(d.status)),
    [dashboards],
  );
  const cancelledReservations = useMemo(
    () => dashboards.filter((d) => d.status === 'ANNULEE'),
    [dashboards],
  );

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/login?redirect=/suivi');
    }
  }, [isLoading, user, router]);

  const load = useCallback(async () => {
    setLoadingData(true);
    setError('');
    try {
      const data = await fetchPortalDashboard();
      setDashboards(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger votre suivi.');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const loadScheduleForReservation = useCallback(async (reservationId: string) => {
    setScheduleLoadingMap((prev) => ({ ...prev, [reservationId]: true }));
    setScheduleErrorMap((prev) => ({ ...prev, [reservationId]: '' }));
    try {
      const schedule = await fetchPaymentSchedule(reservationId);
      setSchedulesMap((prev) => ({ ...prev, [reservationId]: schedule }));
    } catch (err) {
      setScheduleErrorMap((prev) => ({
        ...prev,
        [reservationId]:
          err instanceof Error ? err.message : 'Impossible de charger votre échéancier VEFA.',
      }));
    } finally {
      setScheduleLoadingMap((prev) => ({ ...prev, [reservationId]: false }));
    }
  }, []);

  useEffect(() => {
    dashboards.forEach((d) => {
      void loadScheduleForReservation(d.reservationId);
    });
  }, [dashboards, loadScheduleForReservation]);

  const handlePayInstallment = async (installmentId: string) => {
    if (payingInstallmentId) return; // Garde-fou anti double-clic
    setPayingInstallmentId(installmentId);
    setPaymentErrorMap((prev) => ({ ...prev, [installmentId]: '' }));
    try {
      const res = await payInstallment(installmentId, 'STRIPE');
      if (!res || !res.paymentUrl) {
        throw new Error('URL de redirection Stripe non reçue.');
      }
      window.location.href = res.paymentUrl;
    } catch (err) {
      setPaymentErrorMap((prev) => ({
        ...prev,
        [installmentId]:
          err instanceof Error ? err.message : "Impossible d'initialiser le paiement Stripe.",
      }));
      setPayingInstallmentId(null);
    }
  };

  const handleCancelReservation = async (reservationId: string) => {
    if (cancellingReservationId) return; // Garde-fou anti double-clic
    if (confirmingCancelId !== reservationId) {
      setConfirmingCancelId(reservationId);
      setCancelErrorMap((prev) => ({ ...prev, [reservationId]: '' }));
      return;
    }
    setCancellingReservationId(reservationId);
    setCancelErrorMap((prev) => ({ ...prev, [reservationId]: '' }));
    try {
      await cancelReservation(reservationId);
      setConfirmingCancelId(null);
      await load();
    } catch (err) {
      setCancelErrorMap((prev) => ({
        ...prev,
        [reservationId]:
          err instanceof Error ? err.message : "Impossible d'annuler la réservation.",
      }));
    } finally {
      setCancellingReservationId(null);
    }
  };

  const loadDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    setDocumentsError('');
    try {
      const data = await fetchPortalDocuments();
      setDocuments(data);
    } catch (err) {
      setDocumentsError(err instanceof Error ? err.message : 'Impossible de charger vos documents.');
    } finally {
      setDocumentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void loadDocuments();
  }, [user, loadDocuments]);

  const handleDownload = async (documentId: string) => {
    try {
      const { downloadUrl } = await downloadDocument(documentId);
      // URL signée B2 à durée limitée : ouverture directe dans un onglet,
      // le fichier est servi par B2 (jamais par le serveur applicatif).
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    } catch {
      setSigningError('Téléchargement impossible pour le moment.');
    }
  };

  const handleConfirmSignature = async (documentId: string, signature: Blob) => {
    setSigningError('');
    try {
      await signContract(documentId, signature);
      setSigningDocumentId(null);
      await loadDocuments();
    } catch (err) {
      setSigningError(err instanceof Error ? err.message : 'Signature impossible pour le moment.');
    }
  };

  const hasOwnerSignature = (document: PortalDocument) =>
    document.signatures?.some((s) => s.signerType === 'PROPRIETAIRE') ?? false;

  const isFullySigned = (document: PortalDocument) =>
    document.signatures?.some((s) => s.signerType === 'PROPRIETAIRE') === true &&
    document.signatures?.some((s) => s.signerType === 'ADMIN') === true;

  if (isLoading || !user) {
    return (
      <main className="min-h-screen bg-ink text-paper flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="flex items-center gap-3 font-mono text-xs text-paper/60">
            <Loader2 className="w-5 h-5 animate-spin text-laterite-light" /> Vérification de votre session…
          </div>
        </div>
        <Footer />
      </main>
    );
  }

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
            <p className="text-xs text-paper/60 font-mono mt-1">
              Bonjour {user.fullName} — vos réservations et l'avancement du chantier.
            </p>
          </div>
        </div>

        {loadingData ? (
          <div className="flex items-center justify-center gap-3 font-mono text-xs text-paper/60 py-16">
            <Loader2 className="w-5 h-5 animate-spin text-laterite-light" /> Chargement de votre dossier…
          </div>
        ) : error ? (
          <div className="bg-laterite/15 border border-laterite/40 rounded-md p-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-laterite-light shrink-0" />
            <div>
              <p className="text-sm text-paper font-mono">{error}</p>
              <button
                onClick={() => void load()}
                className="mt-3 bg-paper/10 hover:bg-paper/20 text-paper font-mono text-xs px-4 py-2 rounded transition-all"
              >
                Réessayer
              </button>
            </div>
          </div>
        ) : dashboards.length === 0 ? (
          <div className="bg-ink-card border border-paper/20 rounded-md p-10 text-center space-y-4">
            <div className="w-14 h-14 bg-lagoon/15 text-lagoon-light rounded-full flex items-center justify-center mx-auto border border-lagoon/40">
              <Home className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-xl font-semibold text-paper">Aucune réservation en cours</h3>
            <p className="text-xs text-paper/60 font-mono max-w-md mx-auto">
              Vous n'avez pas encore réservé de logement. Parcourez le catalogue et réservez votre
              unité pour activer votre suivi d'échéancier et de chantier.
            </p>
            <a
              href="/#reserver"
              className="inline-flex items-center gap-2 bg-laterite hover:bg-laterite-light text-paper font-mono text-xs px-6 py-3 rounded transition-all font-semibold"
            >
              Parcourir le catalogue →
            </a>
          </div>
        ) : (
          <>
            {activeReservations.length === 0 && (
              <div className="bg-ink-card border border-paper/20 rounded-md p-10 text-center space-y-4">
                <div className="w-14 h-14 bg-lagoon/15 text-lagoon-light rounded-full flex items-center justify-center mx-auto border border-lagoon/40">
                  <Home className="w-6 h-6" />
                </div>
                <h3 className="font-serif text-xl font-semibold text-paper">
                  Aucune réservation en cours
                </h3>
                <p className="text-xs text-paper/60 font-mono max-w-md mx-auto">
                  {cancelledReservations.length > 0
                    ? "Votre réservation précédente a été annulée. Parcourez le catalogue pour en créer une nouvelle."
                    : "Vous n'avez pas encore réservé de logement. Parcourez le catalogue et réservez votre unité pour activer votre suivi d'échéancier et de chantier."}
                </p>
                <a
                  href="/#reserver"
                  className="inline-flex items-center gap-2 bg-laterite hover:bg-laterite-light text-paper font-mono text-xs px-6 py-3 rounded transition-all font-semibold"
                >
                  Parcourir le catalogue →
                </a>
              </div>
            )}
            {activeReservations.map((d) => {
              const { unit, nextInstallment } = d;
              return (
                <div key={d.reservationId} className="space-y-6">
                <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
                  <span className="bg-lagoon/20 text-lagoon-light border border-lagoon/40 px-3 py-1.5 rounded">
                    Réservation n° {d.reservationId}
                  </span>
                  <span
                    className={`px-3 py-1.5 rounded border ${
                      d.status === 'ANNULEE'
                        ? 'bg-laterite/15 text-laterite-light border-laterite/40'
                        : 'bg-paper/10 text-paper/80 border-paper/20'
                    }`}
                  >
                    {reservationStatusLabel(d.status)}
                  </span>
                  <span className="bg-sand/15 text-sand border border-sand/40 px-3 py-1.5 rounded">
                    Lot {unit.block.name} — {unit.block.constructionPhase}
                  </span>
                  {d.status === 'EN_ATTENTE' && (
                    <div className="flex flex-col items-end gap-1 ml-auto">
                      {confirmingCancelId !== d.reservationId ? (
                        <button
                          onClick={() => void handleCancelReservation(d.reservationId)}
                          disabled={cancellingReservationId === d.reservationId}
                          className="inline-flex items-center gap-2 bg-paper/5 hover:bg-paper/10 text-paper/60 hover:text-laterite-light font-mono text-xs px-3 py-1.5 rounded border border-paper/20 hover:border-laterite-light/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          data-testid={`cancel-button-${d.reservationId}`}
                        >
                          <AlertCircle className="w-3 h-3" />
                          Annuler
                        </button>
                      ) : (
                        <div className="inline-flex items-center gap-2">
                          <span className="text-laterite-light text-xs font-semibold">Confirmer ?</span>
                          <button
                            onClick={() => void handleCancelReservation(d.reservationId)}
                            disabled={cancellingReservationId === d.reservationId}
                            className="inline-flex items-center gap-1.5 bg-laterite hover:bg-laterite-light text-paper font-mono text-xs px-2.5 py-1 rounded transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                            data-testid={`confirm-cancel-button-${d.reservationId}`}
                          >
                            {cancellingReservationId === d.reservationId ? (
                              <Loader2 className="w-3 h-3 animate-spin text-paper" />
                            ) : null}
                            Oui
                          </button>
                          <button
                            onClick={() => setConfirmingCancelId(null)}
                            className="inline-flex items-center gap-1.5 bg-paper/10 hover:bg-paper/20 text-paper font-mono text-xs px-2.5 py-1 rounded transition-all"
                          >
                            Non
                          </button>
                        </div>
                      )}
                      {cancelErrorMap[d.reservationId] && (
                        <div
                          className="text-xs font-mono text-laterite-light flex items-center gap-1.5"
                          data-testid={`cancel-error-${d.reservationId}`}
                        >
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{cancelErrorMap[d.reservationId]}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {(unit.marketingDescription || unit.highlights.length > 0 || unit.media.length > 0) && (
                  <div className="bg-ink-card border border-paper/20 rounded-md p-6">
                    <h3 className="font-serif text-xl font-semibold text-paper mb-4 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-sand" /> Votre Logement
                    </h3>

                    <div className="flex flex-col md:flex-row gap-6">
                      {unit.media.length > 0 && (
                        <div className="md:w-2/5 shrink-0">
                          <img
                            src={unit.media[0].url}
                            alt={unit.media[0].altText || `Rendu ${unit.type}`}
                            className="w-full h-48 md:h-56 object-cover rounded border border-paper/15"
                          />
                        </div>
                      )}

                      <div className="flex-1 space-y-4">
                        {unit.marketingDescription && (
                          <p className="text-sm text-paper/80 font-mono leading-relaxed">
                            {unit.marketingDescription}
                          </p>
                        )}

                        {unit.highlights.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {unit.highlights.map((h) => (
                              <span
                                key={h}
                                className="inline-flex items-center gap-1 bg-lagoon/15 text-lagoon-light border border-lagoon/30 px-2.5 py-1 rounded text-xs font-mono"
                              >
                                <CheckCircle2 className="w-3 h-3" /> {h}
                              </span>
                            ))}
                          </div>
                        )}

                        {unit.virtualTourUrl && (
                          <a
                            href={unit.virtualTourUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-xs font-mono text-sand hover:text-sand/80 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Visite virtuelle 360°
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-4 bg-ink-card border border-paper/20 rounded-md p-6 space-y-4">
                    <h3 className="font-serif text-xl font-semibold text-paper border-b border-paper/15 pb-2">
                      Détails du Logement
                    </h3>

                    <div className="space-y-3 font-mono text-xs">
                      <div className="flex justify-between">
                        <span className="text-paper/60">Unité :</span>
                        <span className="text-paper font-bold">{unit.name || unit.type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-paper/60">Bloc :</span>
                        <span className="text-sand">{unit.block.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-paper/60">Surface :</span>
                        <span className="text-paper">{unit.surface} m²</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-paper/60">Étage :</span>
                        <span className="text-paper">{unit.floor}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-paper/60">Prix Total :</span>
                        <span className="text-laterite-light font-bold">
                          {formatXOF(unit.price)} XOF
                        </span>
                      </div>
                      {nextInstallment && (
                        <div className="flex justify-between">
                          <span className="text-paper/60">Prochaine échéance :</span>
                          <span className="text-lagoon-light font-bold">
                            {formatXOF(nextInstallment.amount)} XOF
                          </span>
                        </div>
                      )}
                    </div>

                    <button className="w-full border border-paper/30 hover:border-sand text-paper font-mono text-xs py-2.5 rounded transition-all flex items-center justify-center gap-2">
                      <Download className="w-4 h-4" /> Télécharger Attestation (.PDF)
                    </button>
                  </div>

                  <div className="lg:col-span-8 space-y-6">
                    <div className="bg-ink-card border border-paper/20 rounded-md p-6">
                      <h3 className="font-serif text-xl font-semibold text-paper mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-sand" /> Échéancier de Paiement VEFA
                      </h3>

                      {scheduleLoadingMap[d.reservationId] ? (
                        <div
                          className="flex items-center gap-3 font-mono text-xs text-paper/60 py-6"
                          data-testid="schedule-loading"
                        >
                          <Loader2 className="w-4 h-4 animate-spin text-laterite-light" /> Chargement de votre échéancier VEFA…
                        </div>
                      ) : scheduleErrorMap[d.reservationId] ? (
                        <div
                          className="bg-laterite/15 border border-laterite/40 rounded p-4 flex items-center justify-between gap-3"
                          data-testid="schedule-error"
                        >
                          <div className="flex items-center gap-2 text-xs font-mono text-paper">
                            <AlertCircle className="w-4 h-4 text-laterite-light shrink-0" />
                            <span>{scheduleErrorMap[d.reservationId]}</span>
                          </div>
                          <button
                            onClick={() => void loadScheduleForReservation(d.reservationId)}
                            className="bg-paper/10 hover:bg-paper/20 text-paper font-mono text-xs px-3 py-1.5 rounded transition-all shrink-0"
                          >
                            Réessayer
                          </button>
                        </div>
                      ) : !schedulesMap[d.reservationId] || schedulesMap[d.reservationId].installments.length === 0 ? (
                        <p className="text-xs text-paper/60 font-mono" data-testid="schedule-empty">
                          Aucune échéance enregistrée pour le moment.
                        </p>
                      ) : (
                        <div className="space-y-3 font-mono text-xs" data-testid="schedule-populated">
                          {schedulesMap[d.reservationId].installments.map((inst) => (
                            <div
                              key={inst.id}
                              className="p-3.5 bg-paper/5 border border-paper/10 rounded space-y-2"
                            >
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="font-bold text-paper text-sm">{inst.label}</div>
                                  <div className="text-paper/50">Échéance : {formatDate(inst.dueDate)}</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-laterite-light text-sm mb-1">
                                    {formatXOF(inst.amount)} XOF
                                  </div>
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${
                                      inst.status === 'PAYE'
                                        ? 'text-lagoon-light bg-lagoon/20 border-lagoon/40'
                                        : 'text-paper/50 bg-paper/10 border-paper/20'
                                    }`}
                                  >
                                    {inst.status === 'PAYE' && <CheckCircle2 className="w-3 h-3" />}
                                    {installmentStatusLabel(inst.status)}
                                  </span>
                                </div>
                              </div>

                              {d.status === 'EN_ATTENTE' && inst.status === 'EN_ATTENTE' && (
                                <div className="pt-2 border-t border-paper/10 flex flex-col items-end gap-1.5">
                                  <button
                                    disabled={payingInstallmentId === inst.id}
                                    onClick={() => void handlePayInstallment(inst.id)}
                                    className="inline-flex items-center gap-2 bg-laterite hover:bg-laterite-light disabled:opacity-50 disabled:cursor-not-allowed text-paper font-mono text-xs px-3.5 py-2 rounded transition-all font-semibold"
                                    data-testid={`pay-button-${inst.id}`}
                                  >
                                    {payingInstallmentId === inst.id ? (
                                      <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-paper" />
                                        Redirection Stripe…
                                      </>
                                    ) : (
                                      <>
                                        <CreditCard className="w-3.5 h-3.5" />
                                        Payer par Carte (Stripe)
                                      </>
                                    )}
                                  </button>
                                  {paymentErrorMap[inst.id] && (
                                    <div
                                      className="text-xs font-mono text-laterite-light flex items-center gap-1.5"
                                      data-testid={`payment-error-${inst.id}`}
                                    >
                                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                      <span>{paymentErrorMap[inst.id]}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="bg-ink-card border border-paper/20 rounded-md p-6">
                      <h3 className="font-serif text-xl font-semibold text-paper mb-4 flex items-center gap-2">
                        <HardHat className="w-5 h-5 text-laterite-light" /> Suivi de Chantier en Direct
                      </h3>

                      <div className="p-4 bg-paper/5 border border-paper/10 rounded space-y-3">
                        <div className="flex justify-between items-center font-mono text-xs text-paper/60">
                          <span>
                            Phase : <b>{d.constructionPhase}</b>
                          </span>
                          <span>
                            Avancement : <b>{d.constructionProgress}%</b>
                          </span>
                        </div>
                        <div className="w-full bg-paper/10 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-sand h-full transition-all"
                            style={{ width: `${Math.min(100, Math.max(0, d.constructionProgress))}%` }}
                          />
                        </div>
                        <p className="text-xs text-paper/70 font-mono">
                          Avancement consolidé du lot {unit.block.name} — mis à jour à chaque rapport de chantier.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
            })}
            {cancelledReservations.length > 0 && (
              <div className="space-y-4">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-2 text-xs font-mono text-paper/60 hover:text-paper transition-colors"
                >
                  {showHistory ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  Historique ({cancelledReservations.length} réservation
                  {cancelledReservations.length > 1 ? 's' : ''} annulée
                  {cancelledReservations.length > 1 ? 's' : ''})
                </button>
                {showHistory && (
                  <div className="space-y-3">
                    {cancelledReservations.map((d) => {
                      const { unit } = d;
                      return (
                        <div
                          key={d.reservationId}
                          className="opacity-60 bg-ink-card border border-laterite/20 rounded-md p-4 flex flex-wrap items-center gap-3 font-mono text-xs"
                        >
                          <span className="bg-paper/10 text-paper/80 border border-paper/20 px-3 py-1.5 rounded">
                            Réservation n° {d.reservationId}
                          </span>
                          <span className="bg-laterite/15 text-laterite-light border border-laterite/40 px-3 py-1.5 rounded">
                            Annulée
                          </span>
                          <span className="bg-sand/15 text-sand border border-sand/40 px-3 py-1.5 rounded">
                            Lot {unit.block.name} — {unit.type}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div className="bg-ink-card border border-paper/20 rounded-md p-6">
          <h3 className="font-serif text-xl font-semibold text-paper mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-sand" /> Mes Documents & Contrats
          </h3>

          {documentsLoading ? (
            <div className="flex items-center gap-3 font-mono text-xs text-paper/60 py-8">
              <Loader2 className="w-4 h-4 animate-spin text-laterite-light" /> Chargement de vos
              documents…
            </div>
          ) : documentsError ? (
            <div className="bg-laterite/15 border border-laterite/40 rounded p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-laterite-light shrink-0" />
              <p className="text-xs text-paper font-mono flex-1">{documentsError}</p>
              <button
                onClick={() => void loadDocuments()}
                className="bg-paper/10 hover:bg-paper/20 text-paper font-mono text-xs px-3 py-1.5 rounded"
              >
                Réessayer
              </button>
            </div>
          ) : documents.length === 0 ? (
            <p className="text-xs text-paper/60 font-mono">
              Aucun document disponible pour le moment. Votre contrat apparaîtra ici une fois généré.
            </p>
          ) : (
            <div className="space-y-3">
              {documents.map((document) => {
                const signed = isFullySigned(document);
                const ownerSigned = hasOwnerSignature(document);
                return (
                  <div
                    key={document.id}
                    className="p-3.5 bg-paper/5 border border-paper/10 rounded flex flex-col md:flex-row md:items-center gap-3"
                  >
                    <div className="flex-1">
                      <div className="font-mono text-sm text-paper font-bold">{document.name}</div>
                      <div className="text-xs text-paper/50 font-mono">
                        Créé le {formatDate(document.createdAt)} ·{' '}
                        {signed ? (
                          <span className="text-lagoon-light">Signé</span>
                        ) : ownerSigned ? (
                          <span className="text-sand">Signé propriétaire — en attente de l'administration</span>
                        ) : (
                          <span>En attente de signature</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => void handleDownload(document.id)}
                        className="inline-flex items-center gap-2 border border-paper/30 hover:border-sand text-paper font-mono text-xs px-3 py-2 rounded transition-all"
                      >
                        <Download className="w-4 h-4" /> Télécharger
                      </button>
                      {!signed && !ownerSigned && (
                        <button
                          onClick={() => setSigningDocumentId(document.id)}
                          className="inline-flex items-center gap-2 bg-laterite hover:bg-laterite-light text-paper font-mono text-xs px-3 py-2 rounded transition-all font-semibold"
                        >
                          <PenLine className="w-4 h-4" /> Signer
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {signingDocumentId && (
          <div className="fixed inset-0 bg-ink/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-lg bg-ink border border-paper/25 rounded-md p-5 space-y-4">
              <h4 className="font-serif text-lg font-semibold text-paper">
                Signature de votre contrat
              </h4>
              <p className="text-xs text-paper/60 font-mono">
                Dessinez votre signature manuscrite ci-dessous puis validez. Votre signature est
                transmise de façon sécurisée et l'administration contresignera ensuite.
              </p>
              {signingError && (
                <div className="bg-laterite/15 border border-laterite/40 rounded p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-laterite-light shrink-0" />
                  <p className="text-xs text-paper font-mono">{signingError}</p>
                </div>
              )}
              <SignaturePad
                onConfirm={(blob) => void handleConfirmSignature(signingDocumentId, blob)}
                onCancel={() => {
                  setSigningDocumentId(null);
                  setSigningError('');
                }}
              />
            </div>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}
