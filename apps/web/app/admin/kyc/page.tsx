'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  UserCheck,
  Loader2,
  AlertCircle,
  Eye,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../../components/AuthProvider';
import {
  AdminKycEntry,
  KycStatus,
  approveKyc,
  fetchAdminKyc,
  fetchKycDocumentUrl,
  rejectKyc,
} from '../../../lib/api';

const KYC_BADGES: Record<KycStatus, string> = {
  NON_SOUMIS: 'bg-paper/5 text-paper/50 border-paper/20',
  EN_ATTENTE: 'bg-sand/15 text-sand border-sand/40',
  VALIDE: 'bg-lagoon/15 text-lagoon-light border-lagoon/40',
  REJETE: 'bg-laterite/15 text-laterite-light border-laterite/40',
};

const KYC_LABELS: Record<KycStatus, string> = {
  NON_SOUMIS: 'Non soumise',
  EN_ATTENTE: 'En attente',
  VALIDE: 'Validée',
  REJETE: 'Rejetée',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function AdminKycPage() {
  const { user, isLoading } = useAuth();
  const [entries, setEntries] = useState<AdminKycEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [viewingId, setViewingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [confirmingApproveId, setConfirmingApproveId] = useState<string | null>(null);
  const [rejectingUserId, setRejectingUserId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminKyc();
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les dossiers d\'identité.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const handleView = async (entry: AdminKycEntry) => {
    const docId = entry.latestDocument?.id;
    if (!docId) return;
    setViewingId(entry.id);
    setActionError('');
    try {
      const { url } = await fetchKycDocumentUrl(docId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Aperçu impossible.');
    } finally {
      setViewingId(null);
    }
  };

  const handleApprove = async (entry: AdminKycEntry) => {
    const docId = entry.latestDocument?.id;
    if (!docId) return;
    setApprovingId(entry.id);
    setActionError('');
    setConfirmingApproveId(null);
    try {
      await approveKyc(docId);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Validation impossible.');
      setApprovingId(null);
    }
  };

  const handleReject = async (entry: AdminKycEntry) => {
    const docId = entry.latestDocument?.id;
    if (!docId) return;
    if (!rejectReason.trim()) {
      setActionError('Le motif de rejet est obligatoire.');
      return;
    }
    setRejecting(true);
    setActionError('');
    try {
      await rejectKyc(docId, rejectReason.trim());
      setRejectingUserId(null);
      setRejectReason('');
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Rejet impossible.');
      setRejecting(false);
    }
  };

  const canReview = (entry: AdminKycEntry) =>
    entry.latestDocument !== null && entry.kycStatus !== 'VALIDE';

  if (isLoading || !user) {
    return (
      <main className="min-h-screen bg-ink text-paper flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="flex items-center gap-3 font-mono text-xs text-paper/60">
            <Loader2 className="w-5 h-5 animate-spin text-laterite-light" /> Vérification de votre session…
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
              <UserCheck className="w-4 h-4 text-lagoon-light" />
              Back-Office Vérification d&apos;identité
            </div>
            <h1 className="font-serif text-3xl font-semibold text-paper">
              Dossiers KYC
            </h1>
            <p className="text-xs text-paper/60 font-mono mt-1">
              Pièces soumises par les acquéreurs — validation ou rejet motivé. Les pièces rejetées
              sont purgées automatiquement 15 jours après le rejet.
            </p>
          </div>
        </div>

        {actionError && (
          <div className="bg-laterite/15 border border-laterite/40 rounded p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-laterite-light shrink-0" />
            <p className="text-xs text-paper font-mono flex-1">{actionError}</p>
            {confirmingApproveId && (
              <button
                onClick={() => setConfirmingApproveId(null)}
                className="bg-paper/10 hover:bg-paper/20 text-paper font-mono text-xs px-3 py-1.5 rounded"
              >
                Retour
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-3 font-mono text-xs text-paper/60 py-16">
            <Loader2 className="w-5 h-5 animate-spin text-laterite-light" /> Chargement des dossiers…
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
        ) : entries.length === 0 ? (
          <div className="bg-ink-card border border-paper/20 rounded-md p-10 text-center space-y-4">
            <div className="w-14 h-14 bg-lagoon/15 text-lagoon-light rounded-full flex items-center justify-center mx-auto border border-lagoon/40">
              <UserCheck className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-xl font-semibold text-paper">
              Aucun dossier de vérification
            </h3>
            <p className="text-xs text-paper/60 font-mono">
              Les pièces d&apos;identité soumises par les acquéreurs apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="bg-ink-card border border-paper/20 rounded-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-xs">
                <thead>
                  <tr className="border-b border-paper/15 text-paper/50">
                    <th className="text-left px-5 py-3 font-semibold whitespace-nowrap">Client</th>
                    <th className="text-left px-5 py-3 font-semibold whitespace-nowrap">Statut</th>
                    <th className="text-left px-5 py-3 font-semibold whitespace-nowrap">Pièce soumise le</th>
                    <th className="text-left px-5 py-3 font-semibold whitespace-nowrap">Dépôts</th>
                    <th className="text-left px-5 py-3 font-semibold whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-paper/10 hover:bg-paper/5 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="text-paper font-medium whitespace-nowrap">{entry.fullName}</div>
                        <div className="text-paper/50">{entry.email}</div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`inline-block border px-2.5 py-1 rounded text-[11px] ${KYC_BADGES[entry.kycStatus]}`}>
                          {KYC_LABELS[entry.kycStatus]}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-paper/70 whitespace-nowrap">
                        {entry.latestDocument
                          ? formatDate(entry.latestDocument.createdAt)
                          : '—'}
                      </td>
                      <td className="px-5 py-4 text-paper/60 whitespace-nowrap">{entry.documentCount}</td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {canReview(entry) ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => void handleView(entry)}
                              disabled={viewingId !== null}
                              className="inline-flex items-center gap-1.5 border border-paper/30 hover:border-sand text-paper font-mono text-xs px-2.5 py-1.5 rounded transition-all disabled:opacity-50"
                            >
                              {viewingId === entry.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}{' '}
                              Voir
                            </button>
                            <button
                              onClick={() => setConfirmingApproveId(entry.id)}
                              disabled={approvingId !== null}
                              className="inline-flex items-center gap-1.5 bg-lagoon/20 text-lagoon-light border border-lagoon/40 hover:bg-lagoon/30 font-mono text-xs px-2.5 py-1.5 rounded transition-all disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Valider
                            </button>
                            {entry.kycStatus !== 'REJETE' && (
                              <button
                                onClick={() => {
                                  setRejectingUserId(entry.id);
                                  setRejectReason('');
                                  setActionError('');
                                }}
                                disabled={approvingId !== null}
                                className="inline-flex items-center gap-1.5 bg-laterite/20 text-laterite-light border border-laterite/40 hover:bg-laterite/30 font-mono text-xs px-2.5 py-1.5 rounded transition-all disabled:opacity-50"
                              >
                                <XCircle className="w-3.5 h-3.5" /> Rejeter
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-paper/40">
                            {entry.kycStatus === 'VALIDE' ? 'Déjà validée' : 'Aucune pièce'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-paper/10 text-paper/40 font-mono text-[11px]">
              {entries.length} dossier{entries.length > 1 ? 's' : ''} — trié par activité récente
            </div>
          </div>
        )}

        {confirmingApproveId && (
          <div className="fixed inset-0 bg-ink/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-md bg-ink border border-paper/25 rounded-md p-5 space-y-4">
              <h4 className="font-serif text-lg font-semibold text-paper">
                Valider la vérification ?
              </h4>
              <p className="text-xs text-paper/60 font-mono">
                L&apos;identité de ce client sera considérée comme validée et il pourra signer ses
                contrats de réservation.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmingApproveId(null)}
                  disabled={approvingId !== null}
                  className="border border-paper/30 hover:border-paper/60 text-paper font-mono text-xs px-4 py-2 rounded transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    const entry = entries.find((e) => e.id === confirmingApproveId);
                    if (entry) void handleApprove(entry);
                  }}
                  disabled={approvingId !== null}
                  className="inline-flex items-center gap-2 bg-lagoon hover:bg-lagoon-light text-paper font-mono text-xs px-4 py-2 rounded transition-all font-semibold disabled:opacity-50"
                >
                  {approvingId !== null ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {approvingId !== null ? 'Validation…' : 'Confirmer'}
                </button>
              </div>
            </div>
          </div>
        )}

        {rejectingUserId && (
          <div className="fixed inset-0 bg-ink/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-md bg-ink border border-paper/25 rounded-md p-5 space-y-4">
              <h4 className="font-serif text-lg font-semibold text-paper">
                Rejeter la pièce d&apos;identité
              </h4>
              <p className="text-xs text-paper/60 font-mono">
                Le motif est transmis à l&apos;acquéreur dans son espace — il devra soumettre une
                nouvelle pièce. Indiquez-le clairement.
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                required
                placeholder="Ex. : pièce illisible, document expiré, nom ne correspondant pas…"
                className="w-full bg-ink border border-paper/25 rounded px-3 py-2 text-sm font-mono text-paper placeholder:text-paper/30 focus:border-laterite-light focus:outline-none"
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setRejectingUserId(null)}
                  disabled={rejecting}
                  className="border border-paper/30 hover:border-paper/60 text-paper font-mono text-xs px-4 py-2 rounded transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    const entry = entries.find((e) => e.id === rejectingUserId);
                    if (entry) void handleReject(entry);
                  }}
                  disabled={rejecting || !rejectReason.trim()}
                  className="inline-flex items-center gap-2 bg-laterite hover:bg-laterite-light text-paper font-mono text-xs px-4 py-2 rounded transition-all font-semibold disabled:opacity-50"
                >
                  {rejecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  {rejecting ? 'Rejet en cours…' : 'Rejeter'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}