'use client';

import React, { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, AlertTriangle, Loader2, Crown } from 'lucide-react';
import { setup } from '../../lib/api';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';

function SetupForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('TG');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setIsSubmitting(true);

    try {
      await setup({ email, phone, password, fullName, country });
      router.push('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de créer l\'administrateur.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-ink-card border border-paper/30 rounded-lg max-w-md w-full p-6 sm:p-8 relative shadow-2xl">
      <div className="flex items-center gap-2 text-xs font-mono text-sand mb-1">
        <Crown className="w-4 h-4 text-lagoon-light" />
        <span>SETUP ADMINISTRATEUR</span>
      </div>

      <h1 className="font-serif text-2xl font-semibold text-paper mb-2">Créer le premier admin</h1>
      <p className="text-xs text-paper/70 font-mono mb-6">
        Cette page ne fonctionne qu&apos;une seule fois. Une fois l&apos;administrateur créé, elle sera inaccessible.
      </p>

      {error && (
        <div className="flex items-center gap-2 text-xs text-laterite-light bg-laterite/15 border border-laterite/40 rounded p-3 mb-4 font-mono">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-mono text-xs text-paper/60 uppercase mb-1">Nom complet *</label>
          <input
            type="text"
            required
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ex: Moussa Keita"
            className="w-full bg-paper/5 border border-paper/20 rounded p-2.5 text-sm text-paper font-sans focus:border-laterite-light outline-none"
          />
        </div>

        <div>
          <label className="block font-mono text-xs text-paper/60 uppercase mb-1">Email *</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@terrasses-baguida.tg"
            className="w-full bg-paper/5 border border-paper/20 rounded p-2.5 text-sm text-paper font-sans focus:border-laterite-light outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-mono text-xs text-paper/60 uppercase mb-1">WhatsApp *</label>
            <input
              type="tel"
              required
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+228 90 00 00 00"
              className="w-full bg-paper/5 border border-paper/20 rounded p-2.5 text-sm text-paper font-sans focus:border-laterite-light outline-none"
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-paper/60 uppercase mb-1">Pays</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full bg-paper/5 border border-paper/20 rounded p-2.5 text-sm text-paper font-sans focus:border-laterite-light outline-none"
            >
              <option value="TG">Togo (TG)</option>
              <option value="FR">France (FR)</option>
              <option value="BE">Belgique (BE)</option>
              <option value="CA">Canada (CA)</option>
              <option value="CI">Côte d&apos;Ivoire (CI)</option>
              <option value="BJ">Bénin (BJ)</option>
              <option value="GN">Guinée (GN)</option>
              <option value="SN">Sénégal (SN)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block font-mono text-xs text-paper/60 uppercase mb-1">Mot de passe *</label>
          <input
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8 caractères minimum"
            className="w-full bg-paper/5 border border-paper/20 rounded p-2.5 text-sm text-paper font-sans focus:border-laterite-light outline-none"
          />
        </div>

        <div>
          <label className="block font-mono text-xs text-paper/60 uppercase mb-1">Confirmer le mot de passe *</label>
          <input
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-paper/5 border border-paper/20 rounded p-2.5 text-sm text-paper font-sans focus:border-laterite-light outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-lagoon hover:bg-lagoon-light text-ink font-mono text-xs py-3.5 rounded transition-all mt-4 font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Création en cours…
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" /> Créer l&apos;administrateur
            </>
          )}
        </button>
      </form>

      <p className="text-xs text-paper/60 font-mono mt-5 text-center">
        Déjà un compte ?{' '}
        <a href="/login" className="text-lagoon-light hover:underline">
          Se connecter
        </a>
      </p>
    </div>
  );
}

export default function SetupPage() {
  return (
    <main className="min-h-screen bg-ink text-paper flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-4">
        <Suspense fallback={null}>
          <SetupForm />
        </Suspense>
      </div>
      <Footer />
    </main>
  );
}
