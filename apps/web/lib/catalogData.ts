/**
 * Types partagés du catalogue.
 *
 * Les données de démonstration (prix, compteurs, visuels Unsplash, unités
 * fictives) ont été retirées : le catalogue ne doit afficher que les données
 * réelles servies par l'API (`/v1/catalog/*`). Le fallback ci-dessous ne
 * contient aucune donnée inventée — uniquement l'identité du projet.
 */

export interface ComplexView {
  id: string;
  title: string;
  subtitle: string;
  category: 'masterplan' | 'aerial' | 'facade' | 'garden' | 'amenities';
  imageUrl: string;
  description: string;
  hotspots?: {
    id: string;
    label: string;
    targetType: 'BLOCK' | 'UNIT';
    targetId: string;
    top: string; // percentage
    left: string; // percentage
  }[];
}

export interface UnitFinishingOption {
  id: string;
  category: 'carrelage' | 'cuisine' | 'solaire' | 'domotique';
  name: string;
  description: string;
  priceDeltaXOF: number;
  previewColor?: string;
  previewImage?: string;
  isDefault?: boolean;
}

export interface TechnicalSpec {
  category: string;
  items: { label: string; detail: string }[];
}

export interface Unit3DDetails {
  id: string;
  name: string;
  type: 'STUDIO' | 'T2' | 'T3' | 'T5' | 'COMMERCE';
  blockId: string;
  blockName: string;
  floor: string;
  surfaceHabitableM2: number;
  surfaceTerrasseM2: number;
  surfaceTotaleM2: number;
  ceilingHeightM: number;
  orientation: string;
  startingPriceXOF: number;
  startingPriceFormatted: string;
  availableUnitsCount: number;
  totalUnitsCount: number;
  badge?: string;
  description: string;
  keyFeatures: string[];
  renderPhotos: {
    title: string;
    url: string;
    angle: 'séjour' | 'chambre' | 'cuisine' | 'salle_d_eau' | 'terrasse' | 'exterieur';
  }[];
  floorPlan2DUrl: string;
  floorPlan3DUrl?: string;
  virtualTour3DUrl?: string;
  technicalSpecs: TechnicalSpec[];
  finishingOptions: UnitFinishingOption[];
  estimatedMonthlyRentXOF: number;
  estimatedNetYieldAnnual: number;
}

export interface ComplexInfo {
  name: string;
  location: string;
  titleDeed: string;
  totalLandArea: string;
  deliveryDate: string;
  notaryName: string;
  escrowBank: string;
  views: ComplexView[];
  units: Unit3DDetails[];
}

/** Identité minimale du projet — aucune vue, aucun prix, aucune unité inventée. */
export const DEFAULT_COMPLEX_DATA: ComplexInfo = {
  name: 'Les Terrasses',
  location: 'Gbodjomé, Lomé, Togo',
  titleDeed: '',
  totalLandArea: '',
  deliveryDate: '',
  notaryName: '',
  escrowBank: '',
  views: [],
  units: [],
};
