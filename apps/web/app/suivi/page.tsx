'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import {
  Calendar,
  CheckCircle2,
  HardHat,
  ShieldCheck,
  Download,
  AlertCircle,
  Loader2,
  Home,
} from 'lucide-react';
import { useAuth } from '../../components/AuthProvider';
import { fetchPortalDashboard, PortalDashboard } from '../../lib/api';

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
          dashboards.map((d) => {
            const { unit, nextInstallment } = d;
            return (
              <div key={d.reservationId} className="space-y-6">
                <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
                  <span className="bg-lagoon/20 text-lagoon-light border border-lagoon/40 px-3 py-1.5 rounded">
                    Réservation n° {d.reservationId}
                  </span>
                  <span className="bg-paper/10 text-paper/80 border border-paper/20 px-3 py-1.5 rounded">
                    {reservationStatusLabel(d.status)}
                  </span>
                  <span className="bg-sand/15 text-sand border border-sand/40 px-3 py-1.5 rounded">
                    Lot {unit.block.name} — {unit.block.constructionPhase}
                  </span>
                </div>

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
                        <Calendar className="w-5 h-5 text-sand" /> Prochaine Échéance (XOF)
                      </h3>

                      {nextInstallment ? (
                        <div className="space-y-3 font-mono text-xs">
                          <div className="p-3.5 bg-paper/5 border border-paper/10 rounded flex justify-between items-center">
                            <div>
                              <div className="font-bold text-paper text-sm">{nextInstallment.label}</div>
                              <div className="text-paper/50">Échéance : {formatDate(nextInstallment.dueDate)}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-laterite-light text-sm mb-1">
                                {formatXOF(nextInstallment.amount)} XOF
                              </div>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${
                                  nextInstallment.status === 'PAYE'
                                    ? 'text-lagoon-light bg-lagoon/20 border-lagoon/40'
                                    : 'text-paper/50 bg-paper/10 border-paper/20'
                                }`}
                              >
                                {nextInstallment.status === 'PAYE' && <CheckCircle2 className="w-3 h-3" />}
                                {installmentStatusLabel(nextInstallment.status)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-paper/60 font-mono">
                          Toutes vos échéances sont réglées. Félicitations — plus aucun paiement en attente.
                        </p>
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
          })
        )}
      </div>

      <Footer />
    </main>
  );
}
