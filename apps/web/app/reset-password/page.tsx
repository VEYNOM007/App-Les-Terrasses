'use client';

import React, { Suspense, useState } from 'react';
import { AlertTriangle, CheckCircle2, KeyRound, Loader2, LockKeyhole } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { resetPassword } from '../../lib/api';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!token) {
      setError('Ce lien de réinitialisation est incomplet.');
      return;
    }

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    if (password !== confirmation) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await resetPassword(token, password);
      setMessage(response.message);
      setPassword('');
      setConfirmation('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Réinitialisation impossible.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="bg-ink-card border border-paper/30 rounded-lg max-w-md w-full p-6 sm:p-8 relative shadow-2xl">
      <div className="flex items-center gap-2 text-xs font-mono text-sand mb-1">
        <KeyRound className="w-4 h-4 text-lagoon-light" />
        <span>NOUVEAU MOT DE PASSE</span>
      </div>

      <h1 className="font-serif text-2xl font-semibold text-paper mb-2">Réinitialiser l’accès</h1>
      <p className="text-xs text-paper/70 font-mono mb-6 leading-relaxed">
        Choisissez un nouveau mot de passe pour retrouver votre espace acquéreur.
      </p>

      {error && (
        <div className="flex items-center gap-2 text-xs text-laterite-light bg-laterite/15 border border-laterite/40 rounded p-3 mb-4 font-mono">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {message && (
        <div className="flex items-start gap-2 text-xs text-lagoon-light bg-lagoon/10 border border-lagoon/30 rounded p-3 mb-4 font-mono leading-relaxed">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {message}{' '}
            <a href="/login" className="underline hover:text-paper">
              Se connecter
            </a>
          </span>
        </div>
      )}

      {!message && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-mono text-xs text-paper/60 uppercase mb-1" htmlFor="password">
              Nouveau mot de passe
            </label>
            <div className="relative">
              <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-paper/40" />
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="8 caractères minimum"
                className="w-full bg-paper/5 border border-paper/20 rounded p-2.5 pl-10 text-sm text-paper font-sans focus:border-laterite-light outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-xs text-paper/60 uppercase mb-1" htmlFor="confirmation">
              Confirmer le mot de passe
            </label>
            <div className="relative">
              <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-paper/40" />
              <input
                id="confirmation"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder="••••••••"
                className="w-full bg-paper/5 border border-paper/20 rounded p-2.5 pl-10 text-sm text-paper font-sans focus:border-laterite-light outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-laterite hover:bg-laterite-light text-paper font-mono text-xs py-3.5 rounded transition-all mt-4 font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Mise à jour…
              </>
            ) : (
              <>
                <LockKeyhole className="w-4 h-4" /> Définir le mot de passe
              </>
            )}
          </button>
        </form>
      )}
    </section>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-ink text-paper flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute -right-24 top-16 h-64 w-64 rounded-full border border-lagoon/20" />
        <div className="absolute -left-32 bottom-8 h-72 w-72 rounded-full border border-laterite/20" />
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </div>
      <Footer />
    </main>
  );
}
