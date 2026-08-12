'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldAlert } from 'lucide-react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { useAuth } from '../../components/AuthProvider';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login?redirect=/admin');
    }
  }, [isLoading, user, router]);

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

  if (user.role !== 'ADMIN') {
    return (
      <main className="min-h-screen bg-ink text-paper flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-ink-card border border-paper/20 rounded-md p-10 text-center space-y-4 max-w-md">
            <div className="w-14 h-14 bg-laterite/15 text-laterite-light rounded-full flex items-center justify-center mx-auto border border-laterite/40">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h1 className="font-serif text-2xl font-semibold text-paper">Accès réservé</h1>
            <p className="text-xs text-paper/60 font-mono">
              Cette section est réservée au personnel autorisé.
            </p>
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  return <>{children}</>;
}
