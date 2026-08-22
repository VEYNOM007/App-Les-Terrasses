export interface ViewerHotspotTarget {
  id: string;
}

/**
 * Format canonique d'un hotspot — utilisé par Block.views et Project.views.
 * L'ancien format `{ targetBlockId }` ne doit plus jamais être introduit
 * en écriture. validateHotspotFormat le rejette explicitement.
 */
export interface HotspotTarget {
  targetType: 'BLOCK' | 'UNIT';
  targetId: string;
}

/**
 * Type guard : rejete l'ancien format `targetBlockId` et valide le format
 * unifié `targetType + targetId`. À importer côté admin ET viewer public
 * pour garantir la cohérence (R4 — source unique de vérité).
 */
export function validateHotspotFormat(
  hotspot: { targetType?: unknown; targetId?: unknown; targetBlockId?: unknown },
): hotspot is HotspotTarget {
  if ('targetBlockId' in hotspot) return false;
  const { targetType, targetId } = hotspot;
  return (
    (targetType === 'BLOCK' || targetType === 'UNIT') &&
    typeof targetId === 'string' &&
    targetId.length > 0
  );
}

/**
 * Crée un hotspot avec le format garanti. Le type partial est complété
 * par des valeurs par défaut sûres — impossible de produire un ancien
 * format `targetBlockId` à partir de cette fonction.
 */
export function createHotspot(
  partial: { id: string; label: string; top: string; left: string } & Partial<HotspotTarget>,
): { id: string; label: string; top: string; left: string } & HotspotTarget {
  return {
    id: partial.id,
    label: partial.label,
    top: partial.top,
    left: partial.left,
    targetType: partial.targetType ?? 'UNIT',
    targetId: partial.targetId ?? '',
  };
}

/** Retourne uniquement la cible explicitement référencée par un hotspot. */
export function resolveHotspotTarget<T extends ViewerHotspotTarget>(
  targetId: string,
  targets: T[],
): T | null {
  return targets.find((target) => target.id === targetId) ?? null;
}
