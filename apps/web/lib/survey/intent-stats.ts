/**
 * Agrégats de l'intention avant / après et des atouts choisis.
 *
 * Les deux notes restent toujours séparées : on ne moyenne que les réponses
 * où la note est présente, et l'écart n'est calculé que lorsque les deux
 * notes existent pour la même personne.
 */

export interface IntentEntry {
  intentBefore: number | null;
  intentAfter: number | null;
}

export interface AtoutsEntry {
  topAtouts: string[];
}

export interface IntentStats {
  countBefore: number;
  countAfter: number;
  averageBefore: number | null;
  averageAfter: number | null;
  delta: number | null;
  up: number;
  stable: number;
  down: number;
}

export interface AtoutRank {
  key: string;
  count: number;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((total, value) => total + value, 0);
  return sum / values.length;
}

export function computeIntentStats(entries: IntentEntry[]): IntentStats {
  const before = entries
    .map((entry) => entry.intentBefore)
    .filter((value): value is number => typeof value === 'number');
  const after = entries
    .map((entry) => entry.intentAfter)
    .filter((value): value is number => typeof value === 'number');

  let up = 0;
  let stable = 0;
  let down = 0;

  for (const entry of entries) {
    if (typeof entry.intentBefore !== 'number' || typeof entry.intentAfter !== 'number') {
      continue;
    }
    const diff = entry.intentAfter - entry.intentBefore;
    if (diff > 0) up += 1;
    else if (diff < 0) down += 1;
    else stable += 1;
  }

  const averageBefore = average(before);
  const averageAfter = average(after);

  return {
    countBefore: before.length,
    countAfter: after.length,
    averageBefore,
    averageAfter,
    delta:
      averageBefore !== null && averageAfter !== null
        ? averageAfter - averageBefore
        : null,
    up,
    stable,
    down,
  };
}

export function rankAtouts(entries: AtoutsEntry[]): AtoutRank[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const key of entry.topAtouts) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}
