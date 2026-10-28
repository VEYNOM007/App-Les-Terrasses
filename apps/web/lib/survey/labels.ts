import { BUDGET_OPTIONS, SURVEY_STEPS } from './questions';

const LABELS = new Map<string, string>();

for (const step of SURVEY_STEPS) {
  if (step.kind === 'single' || step.kind === 'multi') {
    for (const option of step.options) {
      LABELS.set(`${step.key}:${option.value}`, option.label);
    }
  }
}

export function answerLabel(field: string, value: string): string {
  return LABELS.get(`${field}:${value}`) ?? value;
}

export function budgetLabel(value: string, currency: string): string {
  const option = BUDGET_OPTIONS.find((item) => item.value === value);
  if (!option) return value;
  return currency === 'EUR' ? option.eur : option.xof;
}

export function currencyLabel(currency: string): string {
  return currency === 'EUR' ? '€' : 'FCFA';
}
