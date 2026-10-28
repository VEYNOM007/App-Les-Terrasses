/**
 * Mode « étude de marché ».
 *
 * Le site sert à mesurer la demande avant la création de l'entité légale :
 * aucune vente, aucun paiement. Le code de vente (réservation, paiement,
 * échéancier, simulateur, VEFA) reste intégralement dans le dépôt — il est
 * seulement masqué côté interface et refusé côté API.
 *
 * Pour rouvrir la vente : passer NEXT_PUBLIC_MARKET_STUDY_MODE=false côté web
 * ET MARKET_STUDY_MODE=false côté API, puis redéployer. Aucune suppression.
 *
 * Valeur par défaut : true (le projet est à l'étude tant que le flag n'est pas
 * explicitement désactivé).
 */
export const MARKET_STUDY_MODE =
  process.env.NEXT_PUBLIC_MARKET_STUDY_MODE !== 'false';

export const MARKET_STUDY_LABEL = "Projet à l'étude";

export const MARKET_STUDY_DISCLAIMER =
  "Projet à l'étude · prix et plans indicatifs";

export const MARKET_STUDY_NOTICE =
  "Aucune vente n'est en cours. Aucun paiement n'est accepté.";

export const SURVEY_PATH = '/avis';
