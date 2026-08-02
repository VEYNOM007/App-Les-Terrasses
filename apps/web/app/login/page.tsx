'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogIn, AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../components/AuthProvider';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(email, password);
      const redirect = searchParams.get('redirect');
      router.push(redirect && redirect.startsWith('/') ? redirect : '/suivi');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-ink-card border border-paper/30 rounded-lg max-w-md w-full p-6 sm:p-8 relative shadow-2xl">
      <div className="flex items-center gap-2 text-xs font-mono text-sand mb-1">
        <ShieldCheck className="w-4 h-4 text-lagoon-light" />
        <span>ESPACE ACQUÉREUR SÉCURISÉ</span>
      </div>

      <h1 className="font-serif text-2xl font-semibold text-paper mb-2">Connexion</h1>
      <p className="text-xs text-paper/70 font-mono mb-6">
        Accédez à votre suivi de logement et à votre échéancier de paiement.
      </p>

      {error && (
        <div className="flex items-center gap-2 text-xs text-laterite-light bg-laterite/15 border border-laterite/40 rounded p-3 mb-4 font-mono">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-mono text-xs text-paper/60 uppercase mb-1">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.com"
            className="w-full bg-paper/5 border border-paper/20 rounded p-2.5 text-sm text-paper font-sans focus:border-laterite-light outline-none"
          />
        </div>

        <div>
          <label className="block font-mono text-xs text-paper/60 uppercase mb-1">Mot de passe</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-paper/5 border border-paper/20 rounded p-2.5 text-sm text-paper font-sans focus:border-laterite-light outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-laterite hover:bg-laterite-light text-paper font-mono text-xs py-3.5 rounded transition-all mt-4 font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Connexion…
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4" /> Se connecter
            </>
          )}
        </button>
      </form>

      <p className="text-xs text-paper/60 font-mono mt-5 text-center">
        Pas encore de compte ?{' '}
        <a href="/register" className="text-lagoon-light hover:underline">
          Créer un compte
        </a>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-ink text-paper flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-4">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
      <Footer />
    </main>
  );
}
