import { describe, expect, it } from 'vitest';
import { buildSubmission } from './validation';
import { initialAnswers } from './questions';

describe('buildSubmission - otherAnswers', () => {
  it('n\'ajoute pas otherAnswers si "Autre" non coché (freins)', () => {
    const answers = initialAnswers();
    answers.blockers = ['PRIX'];
    answers.otherAnswers = { freins: 'trop cher' };
    const sub = buildSubmission(answers, null);
    expect(sub.otherAnswers).toBeUndefined();
  });

  it('ajoute otherAnswers.freins si "AUTRE" coché', () => {
    const answers = initialAnswers();
    answers.blockers = ['PRIX', 'AUTRE'];
    answers.otherAnswers = { freins: 'Projet trop loin' };
    const sub = buildSubmission(answers, null);
    expect(sub.otherAnswers?.freins).toBe('Projet trop loin');
  });

  it('tronque à 200 caractères', () => {
    const answers = initialAnswers();
    answers.blockers = ['AUTRE'];
    answers.otherAnswers = { freins: 'a'.repeat(250) };
    const sub = buildSubmission(answers, null);
    expect(sub.otherAnswers?.freins?.length).toBe(200);
  });

  it('ignore les clés non autorisées', () => {
    const answers = initialAnswers();
    answers.blockers = ['AUTRE'];
    answers.otherAnswers = { freins: 'ok', residence: 'hack' };
    const sub = buildSubmission(answers, null);
    expect(sub.otherAnswers?.freins).toBe('ok');
    expect(sub.otherAnswers?.['residence']).toBeUndefined();
  });

  it('ignore si valeur vide après nettoyage', () => {
    const answers = initialAnswers();
    answers.blockers = ['AUTRE'];
    answers.otherAnswers = { freins: '   ' };
    const sub = buildSubmission(answers, null);
    expect(sub.otherAnswers).toBeUndefined();
  });

  it('accepte les 3 clés autorisées quand "Autre" est coché', () => {
    const answers = initialAnswers();
    answers.blockers = ['AUTRE'];
    answers.decisionMakers = ['AUTRE'];
    answers.reassurances = ['AUTRE'];
    answers.otherAnswers = { freins: 'a', decision: 'b', reassurances: 'c' };
    const sub = buildSubmission(answers, null);
    expect(Object.keys(sub.otherAnswers ?? {}).length).toBe(3);
  });

  it('retire les caractères de contrôle', () => {
    const answers = initialAnswers();
    answers.blockers = ['AUTRE'];
    answers.otherAnswers = { freins: 'a\u0000b\u001fc' };
    const sub = buildSubmission(answers, null);
    expect(sub.otherAnswers?.freins).toBe('abc');
  });
});
