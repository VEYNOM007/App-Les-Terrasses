import { PortalDocument } from './api';

/**
 * Un document (contrat/quittance) lié à une réservation annulée devient
 * obsolète : il reste consultable/téléchargeable en archive, mais ne doit
 * plus être signable (ni affiché comme « actif ») sur le portail acheteur.
 */
export function isDocumentObsolete(document: PortalDocument): boolean {
  return document.reservationStatus === 'ANNULEE';
}

export type SuiviDocumentStatusLabel = {
  text: string;
  tone: 'inherit' | 'sand' | 'lagoon' | 'laterite';
};

/**
 * Contrat finalisé : les deux signatures sont posées (acheteur + promoteur)
 * et la réservation n'est pas annulée. C'est l'état où le PDF contresigné
 * est définitif — le téléchargement sert alors la version `signedFileUrl`.
 */
export function isContractFinalized(document: PortalDocument): boolean {
  return document.buyerSigned && document.adminSigned && !isDocumentObsolete(document);
}

/**
 * Libellé de statut d'un document côté /suivi acheteur (R6/C5).
 *  - obsolète        → réservation annulée (archive)
 *  - signé           → acheté + promoteur (contrat contresigné)
 *  - Palier 1        → acheteur signé, signature promoteur en attente
 *  - sinon           → en attente de la première signature
 */
export function suiviDocumentStatusLabel(document: PortalDocument): SuiviDocumentStatusLabel {
  if (isDocumentObsolete(document)) {
    return { text: 'Réservation annulée — consultable aux archives', tone: 'laterite' };
  }
  if (document.buyerSigned && document.adminSigned) {
    return { text: 'Signé', tone: 'lagoon' };
  }
  if (document.buyerSigned) {
    return { text: 'Signé par vous — en attente de signature promoteur', tone: 'sand' };
  }
  return { text: 'En attente de signature', tone: 'inherit' };
}
