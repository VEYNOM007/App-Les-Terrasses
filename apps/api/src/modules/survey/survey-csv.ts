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
  contact: SurveyCsvContact | null;
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
  'Freins',
  'Rassurances',
  'Pourquoi (texte)',
  'Expérience (texte)',
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
        row.source ?? '',
        labelFor('residence', row.residence),
        labelFor('togoLink', row.togoLink),
        labelFor('projectGoal', row.projectGoal),
        labelFor('preference', row.preference),
        labelFor('budget', row.budget),
        labelFor('budgetCurrency', row.budgetCurrency),
        labelFor('size', row.size),
        labels('decisionMakers', row.decisionMakers),
        labels('blockers', row.blockers),
        labels('reassurances', row.reassurances),
        row.whyText ?? '',
        row.experienceText ?? '',
        row.contact?.email ?? '',
        row.contact?.whatsapp ?? '',
        row.contact?.consent ? 'Oui' : 'Non',
      ]
        .map(csvCell)
        .join(';'),
    );
  }

  // BOM UTF-8 : Excel reconnaît les accents sans manipulation.
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
