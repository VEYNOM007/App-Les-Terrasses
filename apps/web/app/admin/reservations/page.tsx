'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import {
  CalendarClock,
  Loader2,
  AlertCircle,
  Clock,
  User,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../../components/AuthProvider';
import { fetchAdminReservations, AdminReservation } from '../../../lib/api';

const URGENCY_THRESHOLDS = {
  CRITICAL: 4 * 60 * 60 * 1000,
  HIGH: 12 * 60 * 60 * 1000,
  MEDIUM: 24 * 60 * 60 * 1000,
} as const;

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

export default function AdminReservationsPage() {
  const { user, isLoading } = useAuth();
  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminReservations('EN_ATTENTE');
      setReservations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les réservations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const sorted = [...reservations].sort(
    (a, b) => new Date(a.lockExpiresAt).getTime() - new Date(b.lockExpiresAt).getTime(),
  );

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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-paper/15">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-mono tracking-widest text-sand uppercase mb-1">
              <CalendarClock className="w-4 h-4 text-laterite-light" />
              Back-Office Réservations
            </div>
            <h1 className="font-serif text-3xl font-semibold text-paper">
              Réservations en attente
            </h1>
            <p className="text-xs text-paper/60 font-mono mt-1">
              Unités verrouillées — annulation automatique après 48h si aucun acompte reçu.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 font-mono text-xs text-paper/60 py-16">
            <Loader2 className="w-5 h-5 animate-spin text-laterite-light" /> Chargement des réservations…
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
        ) : sorted.length === 0 ? (
          <div className="bg-ink-card border border-paper/20 rounded-md p-10 text-center space-y-4">
            <div className="w-14 h-14 bg-lagoon/15 text-lagoon-light rounded-full flex items-center justify-center mx-auto border border-lagoon/40">
              <CalendarClock className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-xl font-semibold text-paper">
              Aucune réservation en attente
            </h3>
            <p className="text-xs text-paper/60 font-mono max-w-md mx-auto">
              Toutes les unités sont disponibles. Les réservations apparaîtront ici lorsqu'un
              acheteur réserve une unité.
            </p>
          </div>
        ) : (
          <div className="bg-ink-card border border-paper/20 rounded-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-xs">
                <thead>
                  <tr className="border-b border-paper/15 text-paper/50">
                    <th className="text-left px-5 py-3 font-semibold">Réservation</th>
                    <th className="text-left px-5 py-3 font-semibold">Unité</th>
                    <th className="text-left px-5 py-3 font-semibold">Acheteur</th>
                    <th className="text-left px-5 py-3 font-semibold">Créée</th>
                    <th className="text-left px-5 py-3 font-semibold">Expiration</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => {
                    const expiresAt = new Date(r.lockExpiresAt).getTime();
                    const msRemaining = expiresAt - now;
                    const urgency = urgencyClass(msRemaining);

                    return (
                      <tr
                        key={r.id}
                        className="border-b border-paper/10 hover:bg-paper/5 transition-colors"
                      >
                        <td className="px-5 py-4">
                          <span className="bg-lagoon/20 text-lagoon-light border border-lagoon/40 px-2.5 py-1 rounded">
                            {r.id.slice(0, 18)}…
                          </span>
                        </td>
                        <td className="px-5 py-4">
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
                        <td className="px-5 py-4 text-paper/60">
                          {formatRelative(r.createdAt)}
                        </td>
                        <td className="px-5 py-4">
                          {msRemaining <= 0 ? (
                            <span className="inline-flex items-center gap-1.5 bg-laterite/20 text-laterite-light border border-laterite/50 px-2.5 py-1 rounded">
                              <Clock className="w-3 h-3" />
                              Expiration en cours
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1.5 ${urgency}`}>
                              <Clock className="w-3 h-3" />
                              dans {formatDuration(msRemaining)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-paper/10 text-paper/40 font-mono text-[11px]">
              {sorted.length} réservation{sorted.length > 1 ? 's' : ''} en attente — trié par urgence
              croissante
            </div>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}
