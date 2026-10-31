import { describe, expect, it } from 'vitest';
import { computeIntentStats, rankAtouts } from './intent-stats';

describe('computeIntentStats', () => {
  it('moyenne les deux notes séparément', () => {
    const stats = computeIntentStats([
      { intentBefore: 1, intentAfter: 5 },
      { intentBefore: 3, intentAfter: 3 },
      { intentBefore: 2, intentAfter: 4 },
    ]);

    expect(stats.countBefore).toBe(3);
    expect(stats.countAfter).toBe(3);
    expect(stats.averageBefore).toBe(2);
    expect(stats.averageAfter).toBe(4);
    expect(stats.delta).toBe(2);
  });

  it('compte les hausses, stabilités et baisses', () => {
    const stats = computeIntentStats([
      { intentBefore: 2, intentAfter: 4 },
      { intentBefore: 3, intentAfter: 3 },
      { intentBefore: 5, intentAfter: 2 },
      { intentBefore: 4, intentAfter: 5 },
    ]);

    expect(stats.up).toBe(2);
    expect(stats.stable).toBe(1);
    expect(stats.down).toBe(1);
  });

  it('ignore les réponses incomplètes sans casser la moyenne', () => {
    const stats = computeIntentStats([
      { intentBefore: 4, intentAfter: null },
      { intentBefore: null, intentAfter: 2 },
      { intentBefore: null, intentAfter: null },
    ]);

    expect(stats.countBefore).toBe(1);
    expect(stats.countAfter).toBe(1);
    expect(stats.averageBefore).toBe(4);
    expect(stats.averageAfter).toBe(2);
    expect(stats.delta).toBe(-2);
    expect(stats.up + stats.stable + stats.down).toBe(0);
  });

  it('retourne null quand aucune note n’existe', () => {
    const stats = computeIntentStats([{ intentBefore: null, intentAfter: null }]);

    expect(stats.averageBefore).toBeNull();
    expect(stats.averageAfter).toBeNull();
    expect(stats.delta).toBeNull();
  });
});

describe('rankAtouts', () => {
  it('classe les atouts par nombre de choix décroissant', () => {
    const ranks = rankAtouts([
      { topAtouts: ['securite', 'parc'] },
      { topAtouts: ['securite'] },
      { topAtouts: ['mer', 'securite'] },
    ]);

    expect(ranks[0]).toEqual({ key: 'securite', count: 3 });
    expect(ranks.map((rank) => rank.key)).toEqual(['securite', 'mer', 'parc']);
  });

  it('départage les ex æquo par ordre alphabétique', () => {
    const ranks = rankAtouts([{ topAtouts: ['parc'] }, { topAtouts: ['mer'] }]);
    expect(ranks.map((rank) => rank.key)).toEqual(['mer', 'parc']);
  });

  it('retourne une liste vide sans réponse', () => {
    expect(rankAtouts([])).toEqual([]);
    expect(rankAtouts([{ topAtouts: [] }])).toEqual([]);
  });
});
