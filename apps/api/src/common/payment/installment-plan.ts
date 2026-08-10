/**
 * Plan d'échéancier de paiement — SOURCE DE VÉRITÉ UNIQUE.
 *
 * Fonction pure, sans dépendance Prisma/Nest : utilisée à la fois par
 * PaymentService.generateSchedule() (échéancier réel d'une réservation,
 * créé sur offerPrice ?? unit.price) et par GET /catalog/units/:id/
 * payment-preview (aperçu public du simulateur). Il n'existe qu'une
 * seule définition du découpage en tranches dans toute la codebase.
 */

export interface InstallmentPlanTranche {
  label: string;
  percent: number;
  daysFromNow: number;
}

/** Acompte par défaut du projet (10 % du prix). */
export const DEFAULT_DOWN_PAYMENT_PERCENT = 10;

/**
 * Tranches d'équilibre hors acompte, avec leurs poids relatifs.
 * Somme des poids = 0.9 (l'acompte vaut 0.1 par défaut) ; quand l'acompte
 * est personnalisé, ces tranches sont renormalisées sur (1 - acompte) pour
 * que la somme totale fasse toujours 100 % du prix.
 */
export const BALANCE_TRANCHES: readonly InstallmentPlanTranche[] = [
  { label: 'Tranche fondations', percent: 0.2, daysFromNow: 60 },
  { label: 'Tranche gros œuvre', percent: 0.3, daysFromNow: 150 },
  { label: 'Tranche finitions', percent: 0.25, daysFromNow: 270 },
  { label: 'Solde livraison', percent: 0.15, daysFromNow: 365 },
];

/** Échéancier complet par défaut (acompte 10 % + 4 tranches). */
export const DEFAULT_INSTALLMENT_PLAN: readonly InstallmentPlanTranche[] = [
  { label: 'Acompte réservation', percent: 0.1, daysFromNow: 0 },
  ...BALANCE_TRANCHES,
];

export interface BuildInstallmentPlanInput {
  totalAmount: number;
  downPaymentPercent?: number;
  startDate?: Date;
}

export interface InstallmentPlanItem {
  label: string;
  amount: number;
  dueDate: Date;
  percent: number;
}

/**
 * Construit l'échéancier pour un montant donné.
 *
 * Garantie : la somme des montants est STRICTEMENT égale à `totalAmount`
 * (le solde de la dernière tranche absorbe l'écart d'arrondi en FCFA).
 *
 * @throws RangeError si downPaymentPercent hors de [1, 100] ou totalAmount négatif.
 */
export function buildInstallmentPlan({
  totalAmount,
  downPaymentPercent = DEFAULT_DOWN_PAYMENT_PERCENT,
  startDate = new Date(),
}: BuildInstallmentPlanInput): InstallmentPlanItem[] {
  if (totalAmount < 0) {
    throw new RangeError('totalAmount ne peut pas être négatif.');
  }
  if (downPaymentPercent < 1 || downPaymentPercent > 100) {
    throw new RangeError('downPaymentPercent doit être compris entre 1 et 100.');
  }

  const balancePercent = 1 - downPaymentPercent / 100;
  const balanceWeight = BALANCE_TRANCHES.reduce((sum, t) => sum + t.percent, 0);
  const scale = balancePercent / balanceWeight;

  const items: InstallmentPlanItem[] = [
    {
      label: 'Acompte réservation',
      percent: downPaymentPercent / 100,
      amount: 0,
      dueDate: startDate,
    },
    ...BALANCE_TRANCHES.map((tranche) => ({
      label: tranche.label,
      percent: tranche.percent * scale,
      amount: 0,
      dueDate: new Date(startDate.getTime() + tranche.daysFromNow * 24 * 60 * 60 * 1000),
    })),
  ];

  // Montants arrondis à l'entier (FCFA) ; la dernière tranche absorbe
  // l'écart d'arrondi pour garantir somme == totalAmount.
  for (let i = 0; i < items.length - 1; i++) {
    items[i].amount = Math.round(totalAmount * items[i].percent);
  }
  const alreadyAllocated = items
    .slice(0, -1)
    .reduce((sum, item) => sum + item.amount, 0);
  items[items.length - 1].amount = totalAmount - alreadyAllocated;

  // Les tranches de montant nul n'ont aucune réalité de paiement (ex : acompte
  // à 100 % ⇒ plus aucune tranche d'équilibre). Les exclure garde l'échéancier
  // lisible et la somme inchangée (les montants exclus valent 0).
  return items.filter((item) => item.amount > 0);
}
