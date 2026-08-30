// Décision produit : une pièce KYC rejetée est purgée (objet B2 + ligne base)
// 15 jours après le rejet. Les pièces validées ne sont PAS concernées tant que
// la rétention associée n'est pas tranchée.
export const KYC_REJECTED_RETENTION_DAYS = 15;
export const KYC_REJECTED_RETENTION_MS =
  KYC_REJECTED_RETENTION_DAYS * 24 * 60 * 60 * 1000;