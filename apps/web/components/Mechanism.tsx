'use client';

import React from 'react';
import { Smartphone, CheckCircle, Landmark, HardHat } from 'lucide-react';

export default function Mechanism() {
  const steps = [
    {
      num: '01',
      title: 'Vous réservez en ligne',
      desc: 'Choix de votre Studio, T2, T3 ou T5 sur le plan du lot. Acompte sécurisé via Mobile Money (CinetPay) ou carte bancaire avec verrouillage immédiat pendant 48h.',
      icon: Smartphone,
    },
    {
      num: '02',
      title: 'Le seuil de pré-vente est atteint',
      desc: 'Dès que 60% des appartements d\'un bloc sont réservés, le dossier de pré-ventes officiel est constitué pour acter la demande du marché.',
      icon: CheckCircle,
    },
    {
      num: '03',
      title: 'Le financement bancaire est obtenu',
      desc: 'Le dossier de pré-ventes est présenté aux partenaires bancaires comme garantie — le crédit de construction est débloqué pour l\'ensemble du lot.',
      icon: Landmark,
    },
    {
      num: '04',
      title: 'La construction démarre',
      desc: 'Suivi photo, jalons et avancement en temps réel directement sur la PWA, où que vous soyez (Lomé ou diaspora).',
      icon: HardHat,
    },
  ];

  return (
    <section id="mecanisme" className="py-20 bg-paper text-ink">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-mono tracking-widest text-laterite uppercase mb-3">
            <span className="w-5 h-[1px] bg-laterite inline-block" />
            Le Mécanisme de Confiance
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-ink mb-4">
            Aucun lot ne démarre sans financement acté
          </h2>
          <p className="text-ink/75 text-base sm:text-lg leading-relaxed">
            Chaque immeuble se commercialise d'abord sur la plateforme. Une fois le seuil de pré-vente atteint, le prêt de construction est garanti — <em>c'est seulement à ce moment que les travaux démarrent.</em> Votre acompte ne finance jamais un projet hypothétique.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 border-t border-ink/15 pt-8">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div key={idx} className="relative group p-4 rounded hover:bg-ink/5 transition-colors">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-mono text-xs text-laterite font-bold">{step.num} / ÉTAPE</span>
                  <Icon className="w-5 h-5 text-laterite opacity-80" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-ink mb-2">{step.title}</h3>
                <p className="text-sm text-ink/70 leading-relaxed">{step.desc}</p>
                <div className="w-0 group-hover:w-full h-[2px] bg-laterite transition-all duration-300 mt-4" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
