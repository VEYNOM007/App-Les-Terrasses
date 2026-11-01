import { labelFor } from './survey.constants';

export interface SurveyCsvContact {
  email: string | null;
  whatsapp: string | null;
  consent: boolean;
}

export interface SurveyCsvRow {
  createdAt: Date;
  source: string | null;
  residence: string;
  togoLink: string;
  projectGoal: string;
  preference: string;
  budget: string;
  budgetCurrency: string;
  size: string;
  decisionMakers: string[];
  blockers: string[];
  reassurances: string[];
  whyText: string | null;
  experienceText: string | null;
  intentBefore: number | null;
  intentAfter: number | null;
  topAtouts: string[];
  remainingBlockers: string | null;
  otherAnswers?: unknown;
  contact: SurveyCsvContact | null;
}

/**
 * Neutralise l'injection de formule dans une cellule texte saisie par un
 * visiteur. Excel/LibreOffice interprètent une cellule qui commence par
 * `=`, `+`, `-`, `@`, une tabulation ou un retour chariot comme une formule :
 * on préfixe alors d'une apostrophe. Les espaces/tabulations/retours en tête
 * ne doivent pas non plus masquer une formule.
 */
const FORMULA_PREFIXES = new Set(['=', '+', '-', '@', '\t', '\r', '\n']);

function neutralizeFormula(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  const text = String(value);
  if (text.length === 0) return value;

  const first = text[0];
  if (FORMULA_PREFIXES.has(first)) return "'" + text;

  const meaningful = text.trimStart()[0];
  if (meaningful !== undefined && FORMULA_PREFIXES.has(meaningful)) {
    return "'" + text;
  }

  return value;
}

function getOtherText(row: SurveyCsvRow, key: string): string {
  if (!row.otherAnswers || typeof row.otherAnswers !== 'object') return '';
  const value = (row.otherAnswers as Record<string, unknown>)[key];
  if (typeof value !== 'string') return '';
  return neutralizeFormula(value) as string;
}

const HEADERS = [
  'Date (UTC)',
  'Source',
  'Résidence',
  'Lien avec le Togo',
  'Projet',
  'Préférence',
  'Budget',
  'Devise',
  'Taille',
  'Décision',
  'Précision décision (Autre)',
  'Freins',
  'Précision freins (Autre)',
  'Rassurances',
  'Précision rassurances (Autre)',
  'Pourquoi (texte)',
  'Expérience (texte)',
  'Intention avant (1-5)',
  'Intention après (1-5)',
  'Écart',
  'Atouts choisis',
  'Frein restant (texte)',
  'E-mail',
  'WhatsApp',
  'Consentement',
];

/**
 * Échappement CSV : séparateur `;` (Excel français), guillemets doublés,
 * cellules multi-lignes conservées entre guillemets.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[;"\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function labels(field: string, values: string[]): string {
  return values.map((value) => labelFor(field, value)).join(' | ');
}

export function toCsv(rows: SurveyCsvRow[]): string {
  const lines: string[] = [HEADERS.map(csvCell).join(';')];

  for (const row of rows) {
    lines.push(
      [
        row.createdAt.toISOString(),
        neutralizeFormula(row.source ?? '') ?? '',
        labelFor('residence', row.residence),
        labelFor('togoLink', row.togoLink),
        labelFor('projectGoal', row.projectGoal),
        labelFor('preference', row.preference),
        labelFor('budget', row.budget),
        labelFor('budgetCurrency', row.budgetCurrency),
        labelFor('size', row.size),
        labels('decisionMakers', row.decisionMakers),
        neutralizeFormula(getOtherText(row, 'decision')) ?? '',
        labels('blockers', row.blockers),
        neutralizeFormula(getOtherText(row, 'freins')) ?? '',
        labels('reassurances', row.reassurances),
        neutralizeFormula(getOtherText(row, 'reassurances')) ?? '',
        neutralizeFormula(row.whyText ?? '') ?? '',
        neutralizeFormula(row.experienceText ?? '') ?? '',
        row.intentBefore ?? '',
        row.intentAfter ?? '',
        row.intentBefore !== null && row.intentAfter !== null
          ? row.intentAfter - row.intentBefore
          : '',
        labels('topAtouts', row.topAtouts),
        neutralizeFormula(row.remainingBlockers ?? '') ?? '',
        neutralizeFormula(row.contact?.email ?? '') ?? '',
        neutralizeFormula(row.contact?.whatsapp ?? '') ?? '',
        row.contact?.consent ? 'Oui' : 'Non',
      ]
        .map(csvCell)
        .join(';'),
    );
  }

  // BOM UTF-8 : Excel reconnaît les accents sans manipulation.
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
