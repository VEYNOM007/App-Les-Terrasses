'use client';

import React, { useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, KeyRound, Loader2, Mail } from 'lucide-react';
import { requestPasswordReset } from '../../lib/api';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);

    try {
      const response = await requestPasswordReset(email);
      setMessage(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demande impossible.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-ink text-paper flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute -right-24 top-16 h-64 w-64 rounded-full border border-lagoon/20" />
        <div className="absolute -left-32 bottom-8 h-72 w-72 rounded-full border border-laterite/20" />

        <section className="bg-ink-card border border-paper/30 rounded-lg max-w-md w-full p-6 sm:p-8 relative shadow-2xl">
          <div className="flex items-center gap-2 text-xs font-mono text-sand mb-1">
            <KeyRound className="w-4 h-4 text-lagoon-light" />
            <span>ACCÈS SÉCURISÉ</span>
          </div>

          <h1 className="font-serif text-2xl font-semibold text-paper mb-2">Mot de passe oublié</h1>
          <p className="text-xs text-paper/70 font-mono mb-6 leading-relaxed">
            Entrez votre email. Si un compte existe, vous recevrez un lien valable une heure.
          </p>

          {error && (
            <div className="flex items-center gap-2 text-xs text-laterite-light bg-laterite/15 border border-laterite/40 rounded p-3 mb-4 font-mono">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {message && (
            <div className="flex items-start gap-2 text-xs text-lagoon-light bg-lagoon/10 border border-lagoon/30 rounded p-3 mb-4 font-mono leading-relaxed">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-xs text-paper/60 uppercase mb-1" htmlFor="email">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-paper/40" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="vous@exemple.com"
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
                  <Loader2 className="w-4 h-4 animate-spin" /> Envoi en cours…
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" /> Recevoir le lien
                </>
              )}
            </button>
          </form>

          <a href="/login" className="flex items-center justify-center gap-2 text-xs text-paper/60 font-mono mt-5 hover:text-lagoon-light">
            <ArrowLeft className="w-3.5 h-3.5" /> Retour à la connexion
          </a>
        </section>
      </div>
      <Footer />
    </main>
  );
}
