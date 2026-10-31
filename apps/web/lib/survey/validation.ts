import type { BudgetCurrency, SurveyAnswers, SurveyStep } from './questions';

export interface SurveyContactPayload {
  email: string | null;
  whatsapp: string | null;
  consent: boolean;
}

export interface SurveySubmission {
  source: string | null;
  residence: string;
  togoLink: string;
  projectGoal: string;
  preference: string;
  whyText: string | null;
  budget: string;
  budgetCurrency: BudgetCurrency;
  size: string;
  decisionMakers: string[];
  blockers: string[];
  reassurances: string[];
  experienceText: string | null;
  intentBefore?: number | null;
  intentAfter?: number | null;
  topAtouts?: string[];
  remainingBlockers?: string | null;
  contact: SurveyContactPayload | null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?[\d\s().-]{7,20}$/;

export function isEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function isPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return PHONE_PATTERN.test(value.trim()) && digits.length >= 7 && digits.length <= 15;
}

/**
 * Le `?src=` vient d'un QR code / d'un flyer : on ne conserve qu'un identifiant
 * court et sûr, pour éviter toute injection dans la base ou le CSV.
 */
export function sanitizeSource(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
  return cleaned.length > 0 ? cleaned : null;
}

export function contactError(answers: SurveyAnswers): string | null {
  const email = answers.contactEmail.trim();
  const whatsapp = answers.contactWhatsapp.trim();

  if (email.length === 0 && whatsapp.length === 0) return null;
  if (!answers.consent) {
    return 'Cochez la case de consentement pour être recontacté.';
  }
  if (email.length > 0 && !isEmail(email)) {
    return 'Vérifiez votre adresse e-mail.';
  }
  if (whatsapp.length > 0 && !isPhone(whatsapp)) {
    return 'Vérifiez votre numéro WhatsApp (7 à 15 chiffres).';
  }
  return null;
}

export function isStepComplete(step: SurveyStep, answers: SurveyAnswers): boolean {
  switch (step.kind) {
    case 'single':
      return answers[step.key].length > 0;
    case 'multi':
      return answers[step.key].length > 0;
    case 'text':
      return answers[step.key].length <= step.maxLength;
    case 'intent': {
      const value = answers[step.key];
      return value !== null && value >= 1 && value <= 5;
    }
    case 'atouts':
      return true;
    case 'topAtouts':
      return answers.topAtouts.length <= 3;
    case 'remainingBlockers':
      return answers.remainingBlockers.length <= step.maxLength;
    case 'budget':
      return answers.budget.length > 0;
    case 'contact':
      return contactError(answers) === null;
  }
}

export function stepErrorMessage(step: SurveyStep): string {
  switch (step.kind) {
    case 'single':
      return 'Choisissez une réponse pour continuer.';
    case 'multi':
      return 'Choisissez au moins une réponse pour continuer.';
    case 'text':
      return 'Votre texte est trop long.';
    case 'intent':
      return 'Donnez une note de 1 à 5 pour continuer.';
    case 'atouts':
      return 'Faites défiler pour continuer.';
    case 'topAtouts':
      return 'Sélectionnez 1 à 3 atouts pour continuer.';
    case 'remainingBlockers':
      return 'Votre texte est trop long.';
    case 'budget':
      return 'Choisissez une fourchette de budget.';
    case 'contact':
      return 'Vérifiez les informations de contact.';
  }
}

function trimmedOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildSubmission(
  answers: SurveyAnswers,
  source: string | null,
): SurveySubmission {
  const email = answers.contactEmail.trim().toLowerCase();
  const whatsapp = answers.contactWhatsapp.trim();
  const hasContact = email.length > 0 || whatsapp.length > 0;

  return {
    source: sanitizeSource(source),
    residence: answers.residence,
    togoLink: answers.togoLink,
    projectGoal: answers.projectGoal,
    preference: answers.preference,
    whyText: trimmedOrNull(answers.whyText),
    budget: answers.budget,
    budgetCurrency: answers.budgetCurrency,
    size: answers.size,
    decisionMakers: [...answers.decisionMakers],
    blockers: [...answers.blockers],
    reassurances: [...answers.reassurances],
    experienceText: trimmedOrNull(answers.experienceText),
    intentBefore: typeof answers.intentBefore === 'number' ? answers.intentBefore : null,
    intentAfter: typeof answers.intentAfter === 'number' ? answers.intentAfter : null,
    topAtouts: Array.isArray(answers.topAtouts) ? [...answers.topAtouts].slice(0, 3) : [],
    remainingBlockers: trimmedOrNull(answers.remainingBlockers),
    contact: hasContact
      ? {
          email: email.length > 0 ? email : null,
          whatsapp: whatsapp.length > 0 ? whatsapp : null,
          consent: answers.consent,
        }
      : null,
  };
}
