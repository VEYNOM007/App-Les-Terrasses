import { PortalDocument } from './api';

/**
 * Un document (contrat/quittance) lié à une réservation annulée devient
 * obsolète : il reste consultable/téléchargeable en archive, mais ne doit
 * plus être signable (ni affiché comme « actif ») sur le portail acheteur.
 */
export function isDocumentObsolete(document: PortalDocument): boolean {
  return document.reservationStatus === 'ANNULEE';
}
