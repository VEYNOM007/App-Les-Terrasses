import type { CatalogUnit, TypologyGroup, TypologyUnit, UnitMedia } from '../api';

export interface UnitCard {
  type: string;
  id: string;
  name: string;
  blockName: string;
  floor: number;
  surface: number;
  priceXOF: number;
  priceFormatted: string;
  availableUnitsCount: number;
  totalUnitsCount: number;
  isSoldOut: boolean;
  statusBadge: string | null;
  thumbnailUrl: string | null;
  thumbnailIsRendu3D: boolean;
}

export const TYPE_LABELS: Record<string, string> = {
  STUDIO: 'Studio',
  T2: 'Appartement T2',
  T3: 'Appartement T3',
  T4: 'Appartement T4',
  T5: 'Appartement T5',
  COMMERCE: 'Local Commercial',
};

/**
 * Point de passage unique pour convertir un montant (Decimal Prisma) reçu en
 * string depuis l'API. Échoue bruyamment sur un format inattendu plutôt que de
 * propager un NaN silencieux.
 */
export function toNumber(value: string): number {
  if (value.trim() === '') {
    throw new RangeError(`Montant invalide reçu de l'API : "${value}"`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new RangeError(`Montant invalide reçu de l'API : "${value}"`);
  }
  return parsed;
}

export function formatXOF(value: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(value)} FCFA`;
}

/**
 * Unité représentative d'une typologie : la moins chère disponible, sinon
 * la première de la liste (typologie épuisée) — elle reste interrogeable.
 */
export function selectRepresentativeUnit(units: TypologyUnit[]): TypologyUnit | null {
  if (units.length === 0) return null;
  return units.find((u) => u.status === 'DISPONIBLE') ?? units[0];
}

/**
 * Vignette de la carte : premier média non-PLAN (ordre sortOrder). Le badge
 * "Vue d'artiste" suit le type réel de CE média, jamais le booléen du groupe.
 */
export function thumbnailMedia(media: UnitMedia[]): UnitMedia | null {
  return media.find((m) => m.type !== 'PLAN') ?? null;
}

export function mapTypologyToCard(group: TypologyGroup, unit: CatalogUnit): UnitCard {
  const priceXOF = toNumber(unit.price);
  const thumb = thumbnailMedia(unit.media);
  const isSoldOut = group.availableUnits === 0;
  return {
    type: group.type,
    id: unit.id,
    name: TYPE_LABELS[group.type] ?? group.type,
    blockName: unit.block.name,
    floor: unit.floor,
    surface: unit.surface,
    priceXOF,
    priceFormatted: formatXOF(priceXOF),
    availableUnitsCount: group.availableUnits,
    totalUnitsCount: group.totalUnits,
    isSoldOut,
    statusBadge: isSoldOut ? 'Complet' : null,
    thumbnailUrl: thumb?.url ?? null,
    thumbnailIsRendu3D: thumb?.type === 'RENDU_3D',
  };
}

export function buildCards(groups: TypologyGroup[], units: CatalogUnit[]): UnitCard[] {
  return groups.flatMap((group) => {
    const representative = selectRepresentativeUnit(group.units);
    if (!representative) return [];
    const unit = units.find((u) => u.id === representative.id);
    if (!unit) return [];
    return [mapTypologyToCard(group, unit)];
  });
}
