/**
 * Valeurs autorisées du questionnaire d'étude de marché.
 *
 * Ces listes sont la source de vérité côté API : un client ne peut pas
 * enregistrer une réponse hors référentiel, même en contournant l'interface.
 */

export const RESIDENCE_VALUES = [
  'LOME',
  'TOGO_AUTRE',
  'FRANCE',
  'EUROPE_AUTRE',
  'AUTRE',
] as const;

export const TOGO_LINK_VALUES = ['RESIDENT', 'DIASPORA', 'LES_DEUX'] as const;

export const PROJECT_GOAL_VALUES = [
  'RESIDENCE_PRINCIPALE',
  'FAMILLE',
  'LOCATIF',
  'RETRAITE',
] as const;

export const PREFERENCE_VALUES = ['APPARTEMENT', 'MAISON_TERRAIN', 'TERRAIN_SEUL'] as const;

export const BUDGET_VALUES = ['LT_20M', '20_35M', '35_50M', '50_75M', 'GT_75M'] as const;

export const BUDGET_CURRENCY_VALUES = ['XOF', 'EUR'] as const;

export const SIZE_VALUES = ['STUDIO', 'T2', 'T3', 'T4', 'T5'] as const;

export const DECISION_MAKER_VALUES = [
  'MOI',
  'CONJOINT',
  'PARENTS',
  'ONCLES_TANTES',
  'AUTRE',
] as const;

export const BLOCKER_VALUES = [
  'CHANTIER',
  'TITRE_FONCIER',
  'ELOIGNEMENT',
  'AVIS_FAMILLE',
  'PRIX',
  'AUTRE',
] as const;

export const REASSURANCE_VALUES = [
  'TITRE_PAR_LOT',
  'SUIVI_PHOTO',
  'PAIEMENT_ECHELONNE',
  'GARANTIES',
  'CONCIERGERIE',
  'VISITE_SUR_PLACE',
] as const;

export const TOP_ATOUTS_VALUES = ['securite', 'parc', 'services', 'conciergerie', 'mer', 'commerces'] as const;

export const TOP_ATOUTS_LABELS: Record<string, string> = {
  securite: 'Résidence fermée et sécurisée',
  parc: 'Parc central planté',
  services: 'Services partagés entre résidents',
  conciergerie: 'Option de conciergerie pour louer votre appartement',
  mer: 'À environ 550 m de la mer et 3 minutes d’Agbodrafo en voiture',
  commerces: 'Locaux commerciaux prévus dans la résidence',
};

/** Version du texte de consentement accepté par le répondant. */
export const SURVEY_CONSENT_VERSION = '2026-10-28';

/** Libellés utilisés dans l'export CSV (l'admin affiche les siens côté web). */
export const SURVEY_FIELD_LABELS: Record<string, Record<string, string>> = {
  residence: {
    LOME: 'Lomé',
    TOGO_AUTRE: 'Ailleurs au Togo',
    FRANCE: 'France',
    EUROPE_AUTRE: 'Autre pays d’Europe',
    AUTRE: 'Ailleurs dans le monde',
  },
  togoLink: {
    RESIDENT: 'Résident',
    DIASPORA: 'Diaspora',
    LES_DEUX: 'Les deux',
  },
  projectGoal: {
    RESIDENCE_PRINCIPALE: 'Résidence principale',
    FAMILLE: 'Famille',
    LOCATIF: 'Investissement locatif',
    RETRAITE: 'Retraite / retour au pays',
  },
  preference: {
    APPARTEMENT: 'Appartement en résidence sécurisée',
    MAISON_TERRAIN: 'Maison / mini-villa avec terrain',
    TERRAIN_SEUL: 'Terrain seul',
  },
  budget: {
    LT_20M: 'Moins de 20 M FCFA',
    '20_35M': '20 à 35 M FCFA',
    '35_50M': '35 à 50 M FCFA',
    '50_75M': '50 à 75 M FCFA',
    GT_75M: 'Plus de 75 M FCFA',
  },
  budgetCurrency: {
    XOF: 'FCFA',
    EUR: 'Euro',
  },
  size: {
    STUDIO: 'Studio',
    T2: 'T2',
    T3: 'T3',
    T4: 'T4',
    T5: 'T5',
  },
  topAtouts: {
    securite: 'Résidence fermée et sécurisée',
    parc: 'Parc central planté',
    services: 'Services partagés entre résidents',
    conciergerie: 'Option de conciergerie pour louer votre appartement',
    mer: 'À environ 550 m de la mer et 3 minutes d’Agbodrafo en voiture',
    commerces: 'Locaux commerciaux prévus dans la résidence',
  },
  decisionMakers: {
    MOI: 'Moi',
    CONJOINT: 'Conjoint(e)',
    PARENTS: 'Parents',
    ONCLES_TANTES: 'Oncles et tantes',
    AUTRE: 'Autre',
  },
  blockers: {
    CHANTIER: 'Chantier non terminé',
    TITRE_FONCIER: 'Titre foncier',
    ELOIGNEMENT: 'Éloignement',
    AVIS_FAMILLE: 'Avis de la famille',
    PRIX: 'Prix',
    AUTRE: 'Autre',
  },
  reassurances: {
    TITRE_PAR_LOT: 'Titre foncier par lot',
    SUIVI_PHOTO: 'Suivi photo / vidéo',
    PAIEMENT_ECHELONNE: 'Paiement échelonné',
    GARANTIES: 'Garanties écrites',
    CONCIERGERIE: 'Conciergerie',
    VISITE_SUR_PLACE: 'Visite sur place',
  },
};

export function labelFor(field: string, value: string): string {
  return SURVEY_FIELD_LABELS[field]?.[value] ?? value;
}

/**
 * Le `?src=` vient d'un QR code / flyer : identifiant court et sûr, jamais
 * de HTML, d'espaces ou de caractères de contrôle en base.
 */
export function sanitizeSource(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
  return cleaned.length > 0 ? cleaned : null;
}
