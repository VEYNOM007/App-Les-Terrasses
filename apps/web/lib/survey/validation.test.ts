import { describe, expect, it } from 'vitest';
import { initialAnswers, SURVEY_STEPS, type SurveyAnswers } from './questions';
import {
  buildSubmission,
  contactError,
  isEmail,
  isPhone,
  isStepComplete,
  sanitizeSource,
} from './validation';

function completeAnswers(overrides: Partial<SurveyAnswers> = {}): SurveyAnswers {
  return {
    ...initialAnswers(),
    residence: 'LOME',
    togoLink: 'RESIDENT',
    projectGoal: 'RESIDENCE_PRINCIPALE',
    preference: 'APPARTEMENT',
    budget: '20_35M',
    size: 'T3',
    decisionMakers: ['MOI', 'CONJOINT'],
    blockers: ['PRIX'],
    reassurances: ['TITRE_PAR_LOT'],
    ...overrides,
  };
}

describe('sanitizeSource', () => {
  it('normalise un identifiant de QR code', () => {
    expect(sanitizeSource('  Flyer_QR-01  ')).toBe('flyer_qr-01');
  });

  it('rejette une source vide ou uniquement composée de caractères invalides', () => {
    expect(sanitizeSource(null)).toBeNull();
    expect(sanitizeSource('   ')).toBeNull();
    expect(sanitizeSource('!!!')).toBeNull();
  });

  it('tronque à 64 caractères', () => {
    expect(sanitizeSource('a'.repeat(100))).toHaveLength(64);
  });
});

describe('formats de contact', () => {
  it('accepte un e-mail valide et rejette les autres', () => {
    expect(isEmail('vous@exemple.com')).toBe(true);
    expect(isEmail('vous@exemple')).toBe(false);
    expect(isEmail('pas-un-email')).toBe(false);
  });

  it('accepte un numéro international ou local', () => {
    expect(isPhone('+228 90 12 34 56')).toBe(true);
    expect(isPhone('90123456')).toBe(true);
    expect(isPhone('12')).toBe(false);
  });
});

describe('progression du questionnaire', () => {
  const [residence, , , , whyText, budget, size, decisionMakers, blockers, reassurances] =
    SURVEY_STEPS;

  it('bloque une question à choix unique sans réponse', () => {
    expect(isStepComplete(residence, initialAnswers())).toBe(false);
    expect(isStepComplete(residence, completeAnswers())).toBe(true);
  });

  it('bloque une question à choix multiple sans réponse', () => {
    expect(isStepComplete(decisionMakers, initialAnswers())).toBe(false);
    expect(isStepComplete(decisionMakers, completeAnswers())).toBe(true);
    expect(isStepComplete(blockers, completeAnswers())).toBe(true);
    expect(isStepComplete(reassurances, completeAnswers())).toBe(true);
  });

  it('laisse les textes libres facultatifs', () => {
    expect(isStepComplete(whyText, initialAnswers())).toBe(true);
  });

  it('bloque un texte au-delà de la limite', () => {
    const tooLong = completeAnswers({ whyText: 'a'.repeat(601) });
    expect(isStepComplete(whyText, tooLong)).toBe(false);
  });

  it('bloque le budget tant qu’aucune tranche n’est choisie', () => {
    expect(isStepComplete(budget, initialAnswers())).toBe(false);
    expect(isStepComplete(budget, completeAnswers())).toBe(true);
  });

  it('bloque la taille tant qu’aucune réponse n’est choisie', () => {
    expect(isStepComplete(size, initialAnswers())).toBe(false);
    expect(isStepComplete(size, completeAnswers())).toBe(true);
  });
});

describe('contact facultatif et consentement', () => {
  it('accepte l’absence de contact', () => {
    expect(contactError(initialAnswers())).toBeNull();
  });

  it('refuse un contact sans consentement', () => {
    const answers = completeAnswers({ contactEmail: 'vous@exemple.com' });
    expect(contactError(answers)).toMatch(/consentement/i);
  });

  it('accepte un contact valide avec consentement', () => {
    const answers = completeAnswers({
      contactEmail: 'vous@exemple.com',
      consent: true,
    });
    expect(contactError(answers)).toBeNull();
  });

  it('refuse un e-mail invalide même avec consentement', () => {
    const answers = completeAnswers({ contactEmail: 'invalide', consent: true });
    expect(contactError(answers)).toMatch(/e-mail/i);
  });

  it('refuse un WhatsApp invalide même avec consentement', () => {
    const answers = completeAnswers({ contactWhatsapp: '12', consent: true });
    expect(contactError(answers)).toMatch(/whatsapp/i);
  });
});

describe('buildSubmission', () => {
  it('nettoie les champs et sépare le contact', () => {
    const answers = completeAnswers({
      whyText: '  Le calme et la sécurité.  ',
      experienceText: '   ',
      contactEmail: '  VOUS@Exemple.COM ',
      contactWhatsapp: ' +228 90 12 34 56 ',
      consent: true,
    });

    const payload = buildSubmission(answers, ' Flyer-01 ');

    expect(payload.source).toBe('flyer-01');
    expect(payload.whyText).toBe('Le calme et la sécurité.');
    expect(payload.experienceText).toBeNull();
    expect(payload.contact).toEqual({
      email: 'vous@exemple.com',
      whatsapp: '+228 90 12 34 56',
      consent: true,
    });
  });

  it('envoie un contact nul quand aucun identifiant n’est renseigné', () => {
    const payload = buildSubmission(completeAnswers(), null);
    expect(payload.contact).toBeNull();
    expect(payload.source).toBeNull();
  });

  it('copie les tableaux pour ne pas muter l’état du formulaire', () => {
    const answers = completeAnswers();
    const payload = buildSubmission(answers, null);
    payload.decisionMakers.push('PARENTS');
    expect(answers.decisionMakers).toEqual(['MOI', 'CONJOINT']);
  });
});

describe('intention avant / après', () => {
  const intentBefore = SURVEY_STEPS.find((step) => step.key === 'intentBefore');
  const intentAfter = SURVEY_STEPS.find((step) => step.key === 'intentAfter');

  it('trouve les deux écrans d’intention dans le parcours', () => {
    expect(intentBefore?.kind).toBe('intent');
    expect(intentAfter?.kind).toBe('intent');
  });

  it('refuse une note absente ou hors de 1 à 5', () => {
    expect(isStepComplete(intentBefore!, initialAnswers())).toBe(false);
    expect(isStepComplete(intentBefore!, completeAnswers({ intentBefore: 0 }))).toBe(false);
    expect(isStepComplete(intentBefore!, completeAnswers({ intentBefore: 6 }))).toBe(false);
  });

  it('accepte chaque note de 1 à 5', () => {
    for (const note of [1, 2, 3, 4, 5]) {
      expect(isStepComplete(intentBefore!, completeAnswers({ intentBefore: note }))).toBe(true);
      expect(isStepComplete(intentAfter!, completeAnswers({ intentAfter: note }))).toBe(true);
    }
  });

  it('conserve les deux notes séparément dans la soumission', () => {
    const payload = buildSubmission(
      completeAnswers({ intentBefore: 2, intentAfter: 5 }),
      null,
    );
    expect(payload.intentBefore).toBe(2);
    expect(payload.intentAfter).toBe(5);
  });

  it('envoie null quand la note est absente', () => {
    const payload = buildSubmission(completeAnswers(), null);
    expect(payload.intentBefore).toBeNull();
    expect(payload.intentAfter).toBeNull();
  });
});

describe('atouts les plus choisis', () => {
  const topAtouts = SURVEY_STEPS.find((step) => step.key === 'topAtouts');

  it('laisse la sélection vide possible', () => {
    expect(isStepComplete(topAtouts!, completeAnswers({ topAtouts: [] }))).toBe(true);
  });

  it('refuse plus de 3 atouts', () => {
    expect(
      isStepComplete(
        topAtouts!,
        completeAnswers({ topAtouts: ['securite', 'parc', 'mer', 'commerces'] }),
      ),
    ).toBe(false);
  });

  it('accepte 1 à 3 atouts', () => {
    expect(isStepComplete(topAtouts!, completeAnswers({ topAtouts: ['securite'] }))).toBe(true);
    expect(
      isStepComplete(topAtouts!, completeAnswers({ topAtouts: ['securite', 'parc', 'mer'] })),
    ).toBe(true);
  });

  it('tronque à 3 atouts dans la soumission', () => {
    const payload = buildSubmission(
      completeAnswers({ topAtouts: ['securite', 'parc', 'mer', 'commerces'] }),
      null,
    );
    expect(payload.topAtouts).toEqual(['securite', 'parc', 'mer']);
  });
});

describe('frein restant', () => {
  const remainingBlockers = SURVEY_STEPS.find(
    (step) => step.key === 'remainingBlockers',
  );

  it('reste facultatif', () => {
    expect(isStepComplete(remainingBlockers!, initialAnswers())).toBe(true);
  });

  it('refuse un texte au-delà de la limite', () => {
    expect(
      isStepComplete(
        remainingBlockers!,
        completeAnswers({ remainingBlockers: 'a'.repeat(2001) }),
      ),
    ).toBe(false);
  });

  it('nettoie le texte dans la soumission', () => {
    const payload = buildSubmission(
      completeAnswers({ remainingBlockers: '   Le financement.  ' }),
      null,
    );
    expect(payload.remainingBlockers).toBe('Le financement.');
  });
});
