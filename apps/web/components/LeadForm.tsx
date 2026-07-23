'use client';

import React, { useState } from 'react';
import { Send, MessageSquare, CheckCircle2 } from 'lucide-react';

export default function LeadForm() {
  const [fullName, setFullName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('lome');
  const [interest, setInterest] = useState('t2');
  const [submitted, setSubmitted] = useState(false);
  const [waUrl, setWaUrl] = useState('#');

  const WHATSAPP_NUMBER = '22890000000'; // Numéro commercial officiel

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const locationText =
      location === 'lome' ? 'À Lomé' :
      location === 'togo' ? 'Ailleurs au Togo' :
      location === 'france' ? 'En France' : 'À l\'étranger';

    const interestText =
      interest === 'studio' ? 'Studio' :
      interest === 't2' ? 'T2' :
      interest === 't3' ? 'T3' :
      interest === 't5' ? 'T5' : 'Local commercial';

    const message = `Bonjour, je souhaite être informé(e) du lancement des Terrasses de Baguida.%0A%0ANom: ${encodeURIComponent(
      fullName
    )}%0AWhatsApp: ${encodeURIComponent(whatsapp)}%0AEmail: ${encodeURIComponent(
      email || 'non renseigné'
    )}%0ARésidence: ${encodeURIComponent(locationText)}%0AIntérêt: ${encodeURIComponent(interestText)}`;

    setWaUrl(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`);
    setSubmitted(true);
  };

  return (
    <section id="reserver" className="py-20 bg-gradient-to-b from-ink to-ink-dark border-t border-paper/15">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5 space-y-4">
            <div className="inline-flex items-center gap-2 text-xs font-mono tracking-widest text-sand uppercase">
              <span className="w-4 h-[1px] bg-laterite-light" />
              Pré-inscription Gratuite
            </div>

            <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-paper">
              Soyez parmi les premiers informés
            </h2>

            <p className="text-sm text-paper/70 leading-relaxed">
              Laissez vos coordonnées pour recevoir la grille de prix en avant-première, les plans d'architecte détaillés et une offre de lancement réservée aux 30 premiers inscrits.
            </p>

            <div className="p-4 bg-paper/5 border-l-2 border-laterite-light rounded-r font-mono text-xs text-sand">
              📌 Aucun engagement financier à cette étape — cette inscription garantit votre priorité au lancement officiel.
            </div>
          </div>

          <div className="lg:col-span-7 bg-ink-card border border-paper/20 rounded-md p-6 sm:p-8">
            {!submitted ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-mono text-xs text-paper/60 uppercase mb-1">Nom complet *</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ex: Akossiwa Mensah"
                      className="w-full bg-paper/5 border border-paper/20 rounded p-3 text-sm text-paper font-sans focus:border-laterite-light outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-mono text-xs text-paper/60 uppercase mb-1">WhatsApp *</label>
                    <input
                      type="tel"
                      required
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="+228 90 00 00 00"
                      className="w-full bg-paper/5 border border-paper/20 rounded p-3 text-sm text-paper font-sans focus:border-laterite-light outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-xs text-paper/60 uppercase mb-1">Adresse Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.com"
                    className="w-full bg-paper/5 border border-paper/20 rounded p-3 text-sm text-paper font-sans focus:border-laterite-light outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-mono text-xs text-paper/60 uppercase mb-1">Vous résidez</label>
                    <select
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full bg-paper/5 border border-paper/20 rounded p-3 text-sm text-paper font-sans focus:border-laterite-light outline-none"
                    >
                      <option value="lome">À Lomé</option>
                      <option value="togo">Ailleurs au Togo</option>
                      <option value="france">En France</option>
                      <option value="europe">Ailleurs en Europe</option>
                      <option value="autre">Ailleurs</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-mono text-xs text-paper/60 uppercase mb-1">Intéressé par</label>
                    <select
                      value={interest}
                      onChange={(e) => setInterest(e.target.value)}
                      className="w-full bg-paper/5 border border-paper/20 rounded p-3 text-sm text-paper font-sans focus:border-laterite-light outline-none"
                    >
                      <option value="studio">Studio</option>
                      <option value="t2">Appartement T2</option>
                      <option value="t3">Appartement T3</option>
                      <option value="t5">Appartement T5 (famille)</option>
                      <option value="commerce">Local Commercial</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-laterite hover:bg-laterite-light text-paper font-mono text-sm py-3.5 rounded transition-all font-semibold flex items-center justify-center gap-2 mt-4"
                >
                  Recevoir les informations de lancement →
                </button>
                <p className="text-[11px] font-mono text-paper/45 text-center">
                  Vous serez recontacté sous 48h ouvrées par l'équipe commerciale.
                </p>
              </form>
            ) : (
              <div className="bg-lagoon/15 border border-lagoon/40 rounded p-6 text-center space-y-4">
                <CheckCircle2 className="w-10 h-10 text-lagoon-light mx-auto" />
                <h3 className="font-serif text-2xl font-semibold text-paper">
                  Inscription Enregistrée !
                </h3>
                <p className="text-sm font-mono text-paper/80">
                  Merci ! Ouvrez WhatsApp pour confirmer directement votre dossier auprès de notre conseiller commercial.
                </p>
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-lagoon hover:bg-lagoon-light text-paper font-mono text-sm px-6 py-3 rounded transition-colors"
                >
                  <MessageSquare className="w-4 h-4" /> Confirmer sur WhatsApp →
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
