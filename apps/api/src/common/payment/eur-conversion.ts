/**
 * Conversion XOF → EUR — SOURCE DE VÉRITÉ UNIQUE.
 *
 * Le franc CFA (BCEAO) est arrimé à l'euro par traité : 1 EUR = 655,957 XOF
 * exactement. Le taux est donc fixe et ne bouge pas ; il reste toutefois
 * surchargeable via STRIPE_EUR_XOF_RATE (déploiement, décision métier).
 *
 * Fonction pure, sans dépendance Nest/Prisma : utilisée à l'initiation
 * d'une Checkout Session Stripe (montant facturé en EUR) et à la
 * vérification du webhook checkout.session.completed (garde-fou montant).
 * Les échéances restent facturées et comptabilisées en XOF : EUR est
 * uniquement le canal de paiement diaspora (Stripe ne supporte pas XOF).
 */

export const DEFAULT_XOF_TO_EUR_RATE = 655.957;

/**
 * Résout le taux XOF→EUR depuis l'environnement.
 * Configuration invalide → erreur explicite (jamais de repli silencieux
 * sur un taux erroné qui ferait payer un montant faux).
 */
export function resolveXofToEurRate(): number {
  const raw = process.env.STRIPE_EUR_XOF_RATE;
  if (!raw) {
    return DEFAULT_XOF_TO_EUR_RATE;
  }
  const rate = Number(raw);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new RangeError(
      `STRIPE_EUR_XOF_RATE invalide : "${raw}" n'est pas un taux > 0.`,
    );
  }
  return rate;
}

/**
 * Convertit un montant XOF en centimes d'euro (unité facturée par Stripe).
 * @throws RangeError si xofAmount négatif ou rate invalide.
 */
export function convertXofToEurCents(xofAmount: number, rate: number): number {
  if (xofAmount < 0) {
    throw new RangeError('xofAmount ne peut pas être négatif.');
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new RangeError('rate doit être un nombre > 0.');
  }
  return Math.round((xofAmount / rate) * 100);
}
