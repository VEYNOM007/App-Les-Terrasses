'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Users,
  Loader2,
  AlertCircle,
  Pencil,
  Check,
  X,
  MapPin,
} from 'lucide-react';
import { useAuth } from '../../../components/AuthProvider';
import { fetchAdminUsers, updateUserAddress, AdminUser } from '../../../lib/api';

const ROLE_BADGES: Record<string, string> = {
  ACHETEUR: 'bg-lagoon/20 text-lagoon-light border-lagoon/40',
  COMMERCIAL: 'bg-sand/20 text-sand border-sand/40',
  ADMIN: 'bg-laterite/20 text-laterite-light border-laterite/40',
  ARTISAN: 'bg-paper/10 text-paper/70 border-paper/30',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function AdminClientsPage() {
  const { user, isLoading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

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
  }, [users, updateScrollHint]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les comptes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const startEdit = (u: AdminUser) => {
    setEditingId(u.id);
    setEditValue(u.address ?? '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
    setSaving(false);
  };

  const saveAddress = async (userId: string) => {
    setSaving(true);
    try {
      const updated = await updateUserAddress(userId, editValue || null);
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la sauvegarde.");
      setSaving(false);
    }
  };

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
              <Users className="w-4 h-4 text-lagoon-light" />
              Back-Office Comptes
            </div>
            <h1 className="font-serif text-3xl font-semibold text-paper">
              Comptes inscrits
            </h1>
            <p className="text-xs text-paper/60 font-mono mt-1">
              {users.length} compte{users.length > 1 ? 's' : ''} au total — tous rôles confondus.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 font-mono text-xs text-paper/60 py-16">
            <Loader2 className="w-5 h-5 animate-spin text-laterite-light" /> Chargement des comptes…
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
        ) : users.length === 0 ? (
          <div className="bg-ink-card border border-paper/20 rounded-md p-10 text-center space-y-4">
            <div className="w-14 h-14 bg-lagoon/15 text-lagoon-light rounded-full flex items-center justify-center mx-auto border border-lagoon/40">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-xl font-semibold text-paper">
              Aucun compte inscrit
            </h3>
          </div>
        ) : (
          <div className="bg-ink-card border border-paper/20 rounded-md overflow-hidden">
            <div className="relative">
              <div
                ref={scrollRef}
                onScroll={updateScrollHint}
                className="overflow-x-auto"
              >
                <table className="w-full font-mono text-xs">
                  <thead>
                    <tr className="border-b border-paper/15 text-paper/50">
                      <th className="text-left px-5 py-3 font-semibold whitespace-nowrap">Nom</th>
                      <th className="text-left px-5 py-3 font-semibold whitespace-nowrap">Téléphone</th>
                      <th className="text-left px-5 py-3 font-semibold whitespace-nowrap">Email</th>
                      <th className="text-left px-5 py-3 font-semibold whitespace-nowrap">Pays</th>
                      <th className="text-left px-5 py-3 font-semibold whitespace-nowrap">Adresse</th>
                      <th className="text-left px-5 py-3 font-semibold whitespace-nowrap">Rôle</th>
                      <th className="text-left px-5 py-3 font-semibold whitespace-nowrap">Inscrit le</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr
                        key={u.id}
                        className="border-b border-paper/10 hover:bg-paper/5 transition-colors"
                      >
                        <td className="px-5 py-4 text-paper font-medium max-w-[200px] truncate whitespace-nowrap">
                          {u.fullName}
                        </td>
                        <td className="px-5 py-4 text-paper/70 whitespace-nowrap">{u.phone}</td>
                        <td className="px-5 py-4 text-paper/70 whitespace-nowrap">{u.email}</td>
                        <td className="px-5 py-4 text-paper/60 whitespace-nowrap">{u.country}</td>
                        <td className="px-5 py-4 whitespace-nowrap">
                        {editingId === u.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              placeholder="Adresse…"
                              autoFocus
                              className="bg-paper/5 border border-paper/20 rounded px-2 py-1 text-xs text-paper font-sans focus:border-lagoon-light outline-none w-48"
                            />
                            <button
                              onClick={() => void saveAddress(u.id)}
                              disabled={saving}
                              className="text-lagoon-light hover:text-lagoon p-0.5"
                            >
                              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={cancelEdit} className="text-paper/40 hover:text-paper p-0.5">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {u.address ? (
                              <span className="text-paper/70">{u.address}</span>
                            ) : (
                              <span className="text-paper/30 italic">Non renseignée</span>
                            )}
                            <button
                              onClick={() => startEdit(u)}
                              className="text-paper/30 hover:text-lagoon-light transition-colors p-0.5"
                              title="Modifier l'adresse"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-block border px-2.5 py-1 rounded text-[11px] ${ROLE_BADGES[u.role] ?? 'bg-paper/10 text-paper/60 border-paper/30'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-paper/50">{formatDate(u.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              {canScrollRight && (
                <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-ink-card via-ink-card/60 to-transparent pointer-events-none" />
              )}
            </div>
            <div className="px-5 py-3 border-t border-paper/10 text-paper/40 font-mono text-[11px]">
              {users.length} compte{users.length > 1 ? 's' : ''} — trié par date d&apos;inscription décroissante
            </div>
          </div>
        )}
      </div>

    </main>
  );
}
