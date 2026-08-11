import type {
  CatalogUnit,
  UnitMediaType,
  UnitStatus,
} from '../api';
import { formatXOF, toNumber, TYPE_LABELS } from './catalogue-grid';

export interface UnitGalleryItem {
  id: string;
  type: UnitMediaType;
  url: string;
  altText: string;
  isRendu3D: boolean;
}

export interface UnitDetailView {
  id: string;
  typeLabel: string;
  blockName: string;
  blockFrontage: string;
  floor: number;
  surfaceM2: number;
  priceXOF: number;
  priceFormatted: string;
  status: UnitStatus;
  canReserve: boolean;
  statusLabel: string | null;
  planUrl: string | null;
  virtualTourUrl: string | null;
  description: string | null;
  highlights: string[];
  gallery: UnitGalleryItem[];
}

export function unitStatusLabel(status: UnitStatus): string {
  switch (status) {
    case 'DISPONIBLE':
      return 'Disponible';
    case 'RESERVE':
      return 'Réservé';
    case 'VENDU':
      return 'Vendu';
    case 'LIVRE':
      return 'Livré';
  }
}

/**
 * Construit la vue fiche depuis le payload réel de GET /catalog/units/:id.
 * Règle de présence : aucun champ affiché n'est inventé. Les données
 * absentes de l'API (finitions, specs, loyer, rendement) n'existent pas dans
 * ce modèle — elles seront ajoutées avec un R0 d'enrichissement data-model.
 */
export function buildUnitDetailView(unit: CatalogUnit): UnitDetailView {
  const gallery = [...unit.media]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((m) => ({
      id: m.id,
      type: m.type,
      url: m.url,
      altText: m.altText,
      isRendu3D: m.type === 'RENDU_3D',
    }));

  const planMedia = gallery.find((m) => m.type === 'PLAN');
  const description =
    unit.marketingDescription !== null && unit.marketingDescription.trim() !== ''
      ? unit.marketingDescription
      : null;

  return {
    id: unit.id,
    typeLabel: TYPE_LABELS[unit.type] ?? unit.type,
    blockName: unit.block.name,
    blockFrontage: unit.block.frontage,
    floor: unit.floor,
    surfaceM2: unit.surface,
    priceXOF: toNumber(unit.price),
    priceFormatted: formatXOF(toNumber(unit.price)),
    status: unit.status,
    canReserve: unit.status === 'DISPONIBLE',
    statusLabel: unit.status === 'DISPONIBLE' ? null : unitStatusLabel(unit.status),
    planUrl: unit.planImage ?? planMedia?.url ?? null,
    virtualTourUrl: unit.virtualTourUrl,
    description,
    highlights: unit.highlights,
    gallery,
  };
}
