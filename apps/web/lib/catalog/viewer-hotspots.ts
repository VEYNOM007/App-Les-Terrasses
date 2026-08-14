export interface ViewerHotspotTarget {
  id: string;
}

/** Retourne uniquement la cible explicitement référencée par un hotspot. */
export function resolveHotspotTarget<T extends ViewerHotspotTarget>(
  targetId: string,
  targets: T[],
): T | null {
  return targets.find((target) => target.id === targetId) ?? null;
}
