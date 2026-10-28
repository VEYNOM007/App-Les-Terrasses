import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import MarketStudyBanner from '../../components/MarketStudyBanner';

export const metadata = {
  title: 'Confidentialité des données — Les Terrasses de Baguida',
  description:
    "Comment les réponses au questionnaire d'étude de marché sont collectées, utilisées et supprimées.",
};

const SECTIONS = [
  {
    title: 'Qui traite vos données ?',
    body: (
      <>
        Le projet <strong>Les Terrasses de Baguida</strong> (Baguida, Lomé,
        Togo). Le projet n&apos;a pas encore d&apos;entité légale : aucun
        contrat de vente n&apos;est proposé et aucun paiement n&apos;est
        accepté. Pour toute question ou demande de suppression :{' '}
        <a
          href="mailto:immo.les.terrasses@gmail.com"
          className="font-medium text-laterite underline underline-offset-4"
        >
          immo.les.terrasses@gmail.com
        </a>
        .
      </>
    ),
  },
  {
    title: 'Quelles données sont collectées ?',
    body: (
      <>
        Les réponses au questionnaire (résidence, projet, budget, attentes) sont
        enregistrées <strong>sans identifiant</strong>. Le contact (e-mail ou
        WhatsApp) est <strong>facultatif</strong> et stocké dans une table
        séparée des réponses. La source d&apos;arrivée (<code>?src=</code>, par
        exemple un QR code de flyer) est conservée dans un cookie pendant
        90 jours. Aucune adresse IP n&apos;est enregistrée avec les réponses.
      </>
    ),
  },
  {
    title: 'Pourquoi et sur quelle base ?',
    body: (
      <>
        Les réponses servent uniquement à l&apos;étude de marché : comprendre la
        demande, ajuster les typologies, les prix et les plans. Le contact
        facultatif est traité sur la base de votre consentement, pour vous
        informer du lancement. Vous pouvez retirer ce consentement à tout
        moment.
      </>
    ),
  },
  {
    title: 'Combien de temps et pour qui ?',
    body: (
      <>
        Les réponses sont conservées le temps de l&apos;étude. Le contact est
        supprimé sur simple demande. Aucune donnée n&apos;est vendue, louée ou
        transmise à un tiers à des fins publicitaires. Seuls les prestataires
        techniques nécessaires au fonctionnement du site (hébergement, stockage
        des images) y accèdent.
      </>
    ),
  },
  {
    title: 'Vos droits',
    body: (
      <>
        Vous pouvez demander l&apos;accès, la rectification, la suppression ou la
        limitation de vos données, et vous opposer à leur utilisation. Écrivez à{' '}
        <a
          href="mailto:immo.les.terrasses@gmail.com"
          className="font-medium text-laterite underline underline-offset-4"
        >
          immo.les.terrasses@gmail.com
        </a>
        . Une réponse vous sera apportée dans les meilleurs délais.
      </>
    ),
  },
] as const;

export default function ConfidentialitePage() {
  return (
    <main className="min-h-screen bg-cream text-body">
      <Navbar />
      <MarketStudyBanner />

      <section className="border-b border-line bg-cream py-12 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <p className="eyebrow text-laterite">Vos données</p>
          <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight text-ink sm:text-4xl">
            Confidentialité des données
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted">
            Ce site sert à une étude de marché. Il ne vend rien et n&apos;accepte
            aucun paiement. Voici précisément ce qui est collecté et pourquoi.
          </p>
        </div>
      </section>

      <section className="bg-cream py-12 sm:py-16">
        <div className="mx-auto max-w-3xl space-y-8 px-4 sm:px-6 lg:px-8">
          {SECTIONS.map((section) => (
            <article key={section.title} className="card p-6 sm:p-8">
              <h2 className="font-serif text-xl font-semibold text-ink">
                {section.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {section.body}
              </p>
            </article>
          ))}

          <div className="rounded-2xl border border-line bg-cream-dim p-6 text-sm text-muted">
            <p>
              <strong className="text-ink">Cookies :</strong> un seul cookie
              fonctionnel (<code>lt_src</code>) mémorise la source d&apos;arrivée
              pendant 90 jours. Aucun cookie publicitaire ni traceur tiers
              n&apos;est utilisé.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
