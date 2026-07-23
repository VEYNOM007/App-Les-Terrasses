'use client';

/**
 * Hook de communication avec l'API backend.
 * En dev, l'API NestJS tourne sur http://localhost:3001 (configurable).
 * En prod, le reverse proxy redirige /api/* vers le backend NestJS.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface SitePlanBlock {
  blockId: string;
  blockName: string;
  frontage: string;
  distanceFromEntranceM: number | null;
  sitePlanPolygon: any;
  launchStatus: 'EN_COMMERCIALISATION' | 'SEUIL_ATTEINT' | 'FINANCEMENT_EN_COURS' | 'EN_CONSTRUCTION' | 'LIVRE';
  constructionPhase: string;
  totalUnits: number;
  soldUnits: number;
  fillRatePercent: number;
}

export interface SitePlanResponse {
  projectId: string;
  projectName: string;
  siteMapImageUrl: string | null;
  blocks: SitePlanBlock[];
}

/**
 * Récupère le plan de masse interactif depuis l'API Catalog.
 */
export async function fetchSitePlan(projectId: string): Promise<SitePlanResponse> {
  const res = await fetch(`${API_BASE_URL}/catalog/projects/${projectId}/site-plan`, {
    next: { revalidate: 30 }, // ISR : revalider toutes les 30s
  });

  if (!res.ok) {
    throw new Error(`Erreur API site-plan: ${res.status}`);
  }

  return res.json();
}

/**
 * Récupère la liste des unités disponibles pour un bloc.
 */
export async function fetchBlockUnits(blockId: string) {
  const res = await fetch(`${API_BASE_URL}/catalog/units?blockId=${blockId}&status=DISPONIBLE`);

  if (!res.ok) {
    throw new Error(`Erreur API units: ${res.status}`);
  }

  return res.json();
}
