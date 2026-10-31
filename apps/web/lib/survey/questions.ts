/**
 * Questionnaire « étude de marché » — 12 questions, une par écran.
 *
 * Les clés envoyées à l'API sont stables (majuscules pour les choix) afin de
 * pouvoir agréger les réponses sans dépendre des libellés affichés.
 */

export type BudgetCurrency = 'XOF' | 'EUR';

export interface SurveyAnswers {
  residence: string;
  togoLink: string;
  projectGoal: string;
  preference: string;
  whyText: string;
  budget: string;
  budgetCurrency: BudgetCurrency;
  size: string;
  decisionMakers: string[];
  blockers: string[];
  reassurances: string[];
  experienceText: string;
  intentBefore: number | null;
  intentAfter: number | null;
  topAtouts: string[];
  remainingBlockers: string;
  contactEmail: string;
  contactWhatsapp: string;
  consent: boolean;
}

export interface SurveyOption {
  value: string;
  label: string;
  description?: string;
}

export type SingleKey = 'residence' | 'togoLink' | 'projectGoal' | 'preference' | 'size';
export type MultiKey = 'decisionMakers' | 'blockers' | 'reassurances';
export type TextKey = 'whyText' | 'experienceText';

export interface SingleQuestion {
  key: SingleKey;
  kind: 'single';
  title: string;
  hint?: string;
  options: SurveyOption[];
}

export interface MultiQuestion {
  key: MultiKey;
  kind: 'multi';
  title: string;
  hint?: string;
  options: SurveyOption[];
}

export interface TextQuestion {
  key: TextKey;
  kind: 'text';
  title: string;
  hint?: string;
  placeholder: string;
  maxLength: number;
  rows?: number;
}

export interface BudgetQuestion {
  key: 'budget';
  kind: 'budget';
  title: string;
  hint: string;
}

export interface ContactQuestion {
  key: 'contact';
  kind: 'contact';
  title: string;
  hint: string;
}

export type IntentKey = 'intentBefore' | 'intentAfter';
export type TopAtoutsKey = 'topAtouts';
export type RemainingBlockersKey = 'remainingBlockers';

export interface IntentQuestion {
  key: IntentKey;
  kind: 'intent';
  title: string;
  hint: string;
}

export interface AtoutsScreen {
  key: 'atouts';
  kind: 'atouts';
  title: string;
  subtitle: string;
  items: string[];
  footnote: string;
}

export interface TopAtoutsQuestion {
  key: TopAtoutsKey;
  kind: 'topAtouts';
  title: string;
  hint: string;
  options: Array<{ value: string; label: string }>;
}

export interface RemainingBlockersQuestion {
  key: RemainingBlockersKey;
  kind: 'remainingBlockers';
  title: string;
  hint: string;
  placeholder: string;
  maxLength: number;
}

export type SurveyStep =
  | SingleQuestion
  | MultiQuestion
  | TextQuestion
  | BudgetQuestion
  | ContactQuestion
  | IntentQuestion
  | AtoutsScreen
  | TopAtoutsQuestion
  | RemainingBlockersQuestion;

export const ATOUTS_ITEMS = [
  'Résidence fermée et sécurisée',
  'Parc central planté',
  'Services partagés entre résidents',
  'Option de conciergerie pour louer votre appartement',
  'À environ 550 m de la mer et 3 minutes d’Agbodrafo en voiture',
  'Locaux commerciaux prévus dans la résidence',
];

export const TOP_ATOUTS_OPTIONS = [
  { value: 'securite', label: 'Résidence fermée et sécurisée' },
  { value: 'parc', label: 'Parc central planté' },
  { value: 'services', label: 'Services partagés entre résidents' },
  { value: 'conciergerie', label: 'Option de conciergerie pour louer votre appartement' },
  { value: 'mer', label: 'Proximité de la mer / Agbodrafo' },
  { value: 'commerces', label: 'Locaux commerciaux prévus dans la résidence' },
];

export const SURVEY_STEPS: SurveyStep[] = [
  {
    key: 'residence',
    kind: 'single',
    title: 'Où résidez-vous aujourd’hui ?',
    options: [
      { value: 'LOME', label: 'À Lomé' },
      { value: 'TOGO_AUTRE', label: 'Ailleurs au Togo' },
      { value: 'FRANCE', label: 'En France' },
      { value: 'EUROPE_AUTRE', label: 'Dans un autre pays d’Europe' },
      { value: 'AUTRE', label: 'Ailleurs dans le monde' },
    ],
  },
  {
    key: 'togoLink',
    kind: 'single',
    title: 'Quel est votre lien avec le Togo ?',
    options: [
      { value: 'RESIDENT', label: 'J’y vis' },
      { value: 'DIASPORA', label: 'Je vis à l’étranger (diaspora)' },
      { value: 'LES_DEUX', label: 'Les deux' },
    ],
  },
  {
    key: 'projectGoal',
    kind: 'single',
    title: 'À quoi servirait ce logement ?',
    options: [
      { value: 'RESIDENCE_PRINCIPALE', label: 'Résidence principale' },
      { value: 'FAMILLE', label: 'Pour ma famille' },
      { value: 'LOCATIF', label: 'Investissement locatif' },
      { value: 'RETRAITE', label: 'Retraite ou retour au pays' },
    ],
  },
  {
    key: 'preference',
    kind: 'single',
    title: 'À budget égal, que préféreriez-vous ?',
    options: [
      {
        value: 'APPARTEMENT',
        label: 'Un appartement en résidence sécurisée',
        description: 'Services communs, gardiennage, proximité des commerces.',
      },
      {
        value: 'MAISON_TERRAIN',
        label: 'Une maison ou mini-villa avec terrain, plus loin',
        description: 'Plus d’espace et un terrain privatif, quitte à s’éloigner.',
      },
      {
        value: 'TERRAIN_SEUL',
        label: 'Un terrain seul',
        description: 'Pour construire à votre rythme.',
      },
    ],
  },
  {
    key: 'whyText',
    kind: 'text',
    title: 'À prix égal, pourquoi choisiriez-vous ce projet ?',
    hint: 'Facultatif. Ce qui ferait vraiment la différence pour vous.',
    placeholder: 'Emplacement, qualité, sécurité, confiance, famille…',
    maxLength: 600,
    rows: 5,
  },
  {
    key: 'budget',
    kind: 'budget',
    title: 'Quel budget envisageriez-vous ?',
    hint: 'Une fourchette suffit. Équivalence indicative : 1 € ≈ 655,957 FCFA.',
  },
  {
    key: 'size',
    kind: 'single',
    title: 'Quelle taille de logement vous conviendrait ?',
    options: [
      { value: 'STUDIO', label: 'Studio' },
      { value: 'T2', label: 'T2' },
      { value: 'T3', label: 'T3' },
      { value: 'T4', label: 'T4' },
      { value: 'T5', label: 'T5' },
    ],
  },
  {
    key: 'decisionMakers',
    kind: 'multi',
    title: 'Qui compte dans la décision ?',
    hint: 'Plusieurs réponses possibles.',
    options: [
      { value: 'MOI', label: 'Moi' },
      { value: 'CONJOINT', label: 'Mon conjoint / ma conjointe' },
      { value: 'PARENTS', label: 'Mes parents' },
      { value: 'ONCLES_TANTES', label: 'Mes oncles et tantes' },
      { value: 'AUTRE', label: 'Une autre personne' },
    ],
  },
  {
    key: 'blockers',
    kind: 'multi',
    title: 'Qu’est-ce qui vous freinerait ?',
    hint: 'Plusieurs réponses possibles.',
    options: [
      { value: 'CHANTIER', label: 'Un chantier qui ne se termine pas' },
      { value: 'TITRE_FONCIER', label: 'Le titre foncier' },
      { value: 'ELOIGNEMENT', label: 'L’éloignement' },
      { value: 'AVIS_FAMILLE', label: 'L’avis de la famille' },
      { value: 'PRIX', label: 'Le prix' },
      { value: 'AUTRE', label: 'Autre chose' },
    ],
  },
  {
    key: 'reassurances',
    kind: 'multi',
    title: 'Qu’est-ce qui vous rassurerait ?',
    hint: 'Plusieurs réponses possibles.',
    options: [
      { value: 'TITRE_PAR_LOT', label: 'Un titre foncier par lot' },
      { value: 'SUIVI_PHOTO', label: 'Un suivi photo et vidéo du chantier' },
      { value: 'PAIEMENT_ECHELONNE', label: 'Un paiement échelonné' },
      { value: 'GARANTIES', label: 'Des garanties écrites' },
      { value: 'CONCIERGERIE', label: 'Une conciergerie' },
      { value: 'VISITE_SUR_PLACE', label: 'Une visite sur place' },
    ],
  },
  {
    key: 'experienceText',
    kind: 'text',
    title: 'Avez-vous déjà acheté un appartement au Togo ?',
    hint: 'Facultatif. Racontez ce qui s’est bien ou mal passé.',
    placeholder: 'Votre expérience, vos inquiétudes, ce que vous avez appris…',
    maxLength: 1200,
    rows: 5,
  },
  {
    key: 'intentBefore',
    kind: 'intent',
    title: 'Si un appartement dans cette résidence vous était proposé, seriez-vous intéressé(e) ?',
    hint: 'Notez votre intention avant de découvrir le détail du programme, de 1 (pas du tout) à 5 (très intéressé(e)).',
  },
  {
    key: 'atouts',
    kind: 'atouts',
    title: 'Ce que prévoit le projet',
    subtitle: 'Les éléments prévus au programme de la résidence',
    items: ATOUTS_ITEMS,
    footnote:
      'Projet à l’étude : ces éléments sont prévus au programme et peuvent évoluer.',
  },
  {
    key: 'intentAfter',
    kind: 'intent',
    title: 'Si un appartement dans cette résidence vous était proposé, seriez-vous intéressé(e) ?',
    hint: 'Notez à nouveau votre intention, de 1 (pas du tout) à 5 (très intéressé(e)).',
  },
  {
    key: 'topAtouts',
    kind: 'topAtouts',
    title: 'Quels 3 atouts comptent le plus pour vous ?',
    hint: 'Sélectionnez jusqu’à 3 éléments.',
    options: TOP_ATOUTS_OPTIONS,
  },
  {
    key: 'remainingBlockers',
    kind: 'remainingBlockers',
    title: 'Qu’est-ce qui vous retiendrait encore ?',
    hint: 'Facultatif. Ce qui pourrait encore vous freiner.',
    placeholder: 'Financement, délais, confiance, informations manquantes…',
    maxLength: 2000,
  },
  {
    key: 'contact',
    kind: 'contact',
    title: 'Comment vous prévenir du lancement ?',
    hint: 'Facultatif. E-mail ou WhatsApp, au choix. Sans contact, vos réponses restent anonymes.',
  },
];

export const BUDGET_OPTIONS: { value: string; xof: string; eur: string }[] = [
  { value: 'LT_20M', xof: 'Moins de 20 M FCFA', eur: 'Moins de 30 000 €' },
  { value: '20_35M', xof: '20 à 35 M FCFA', eur: '30 000 à 53 000 €' },
  { value: '35_50M', xof: '35 à 50 M FCFA', eur: '53 000 à 76 000 €' },
  { value: '50_75M', xof: '50 à 75 M FCFA', eur: '76 000 à 114 000 €' },
  { value: 'GT_75M', xof: 'Plus de 75 M FCFA', eur: 'Plus de 114 000 €' },
];

export function initialAnswers(): SurveyAnswers {
  return {
    residence: '',
    togoLink: '',
    projectGoal: '',
    preference: '',
    whyText: '',
    budget: '',
    budgetCurrency: 'XOF',
    size: '',
    decisionMakers: [],
    blockers: [],
    reassurances: [],
    experienceText: '',
    intentBefore: null,
    intentAfter: null,
    topAtouts: [],
    remainingBlockers: '',
    contactEmail: '',
    contactWhatsapp: '',
    consent: false,
  };
}

export const TOTAL_QUESTIONS = SURVEY_STEPS.length;
