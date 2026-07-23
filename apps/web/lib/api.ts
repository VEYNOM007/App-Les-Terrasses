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

// ────────────────────────────────────────────────────────────
// Réservation
// ────────────────────────────────────────────────────────────

export interface ReservationRequest {
  unitId: string;
}

export interface ReservationResponse {
  id: string;
  unitId: string;
  userId: string;
  status: 'EN_ATTENTE' | 'CONFIRMEE' | 'ANNULEE' | 'LIVREE';
  lockExpiresAt: string;
  createdAt: string;
}

/**
 * Crée une réservation (verrou 48h) sur une unité.
 * Nécessite un token JWT (authentification utilisateur).
 */
export async function createReservation(
  unitId: string,
  token: string,
): Promise<ReservationResponse> {
  const res = await fetch(`${API_BASE_URL}/reservations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ unitId }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: `Erreur ${res.status}` }));
    throw new Error(error.message || `Erreur réservation: ${res.status}`);
  }

  return res.json();
}

// ────────────────────────────────────────────────────────────
// Paiement (initiation)
// ────────────────────────────────────────────────────────────

export interface PaymentInitResponse {
  paymentUrl: string;
  transactionId: string;
  sessionId?: string;
  provider: 'CINETPAY' | 'STRIPE';
}

/**
 * Initie le paiement d'un acompte (première échéance).
 * Retourne une URL de redirection vers CinetPay ou Stripe Checkout.
 */
export async function initiatePayment(
  installmentId: string,
  provider: 'CINETPAY' | 'STRIPE',
  token: string,
): Promise<PaymentInitResponse> {
  const res = await fetch(`${API_BASE_URL}/payments/installments/${installmentId}/pay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ provider }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: `Erreur ${res.status}` }));
    throw new Error(error.message || `Erreur paiement: ${res.status}`);
  }

  return res.json();
}

