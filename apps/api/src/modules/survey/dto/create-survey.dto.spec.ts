import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSurveyDto } from './create-survey.dto';

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    residence: 'LOME',
    togoLink: 'RESIDENT',
    projectGoal: 'RESIDENCE_PRINCIPALE',
    preference: 'APPARTEMENT',
    budget: '20_35M',
    budgetCurrency: 'XOF',
    size: 'T3',
    decisionMakers: ['MOI'],
    blockers: ['PRIX'],
    reassurances: ['TITRE_PAR_LOT'],
    ...overrides,
  };
}

async function errorsFor(overrides: Record<string, unknown>) {
  const dto = plainToInstance(CreateSurveyDto, basePayload(overrides));
  return validate(dto);
}

describe('CreateSurveyDto — intention avant/après', () => {
  it('accepte les notes de 1 à 5', async () => {
    for (const note of [1, 2, 3, 4, 5]) {
      await expect(errorsFor({ intentBefore: note, intentAfter: note })).resolves.toHaveLength(0);
    }
  });

  it.each([0, 6, -1, 2.5, '3'])('refuse la note hors échelle %p', async (value) => {
    const errors = await errorsFor({ intentBefore: value });
    expect(errors.some((error) => error.property === 'intentBefore')).toBe(true);
  });

  it('accepte l’absence des deux notes (rétrocompatibilité)', async () => {
    await expect(errorsFor({})).resolves.toHaveLength(0);
  });

  it('garde les deux notes indépendantes', async () => {
    const errors = await errorsFor({ intentBefore: 2, intentAfter: 6 });
    expect(errors.map((error) => error.property)).toEqual(['intentAfter']);
  });
});

describe('CreateSurveyDto — atouts', () => {
  it.each(['securite', 'parc', 'services', 'conciergerie', 'mer', 'commerces'])(
    'accepte la clé stable %s',
    async (key) => {
      await expect(errorsFor({ topAtouts: [key] })).resolves.toHaveLength(0);
    },
  );

  it('refuse plus de 3 atouts', async () => {
    const errors = await errorsFor({ topAtouts: ['securite', 'parc', 'mer', 'commerces'] });
    expect(errors.some((error) => error.property === 'topAtouts')).toBe(true);
  });

  it('refuse une clé inconnue', async () => {
    const errors = await errorsFor({ topAtouts: ['piscine'] });
    expect(errors.some((error) => error.property === 'topAtouts')).toBe(true);
  });

  it('accepte une sélection vide', async () => {
    await expect(errorsFor({ topAtouts: [] })).resolves.toHaveLength(0);
  });
});

describe('CreateSurveyDto — frein restant', () => {
  it('reste facultatif', async () => {
    await expect(errorsFor({})).resolves.toHaveLength(0);
  });

  it('refuse un texte au-delà de 2000 caractères', async () => {
    const errors = await errorsFor({ remainingBlockers: 'a'.repeat(2001) });
    expect(errors.some((error) => error.property === 'remainingBlockers')).toBe(true);
  });

  it('accepte un texte de 2000 caractères', async () => {
    await expect(errorsFor({ remainingBlockers: 'a'.repeat(2000) })).resolves.toHaveLength(0);
  });
});
