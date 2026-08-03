'use client';

/**
 * Client API backend (NestJS).
 * En dev, l'API tourne sur http://localhost:3001 (configurable).
 * En prod, le reverse proxy redirige /api/* vers le backend NestJS.
 *
 * Authentification : cookies httpOnly posés par le backend (access_token
 * + refresh_token). Tous les fetch passent credentials: 'include' pour
 * envoyer/recevoir les cookies ; plus aucun token en localStorage.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: `Erreur ${res.status}` }));
    throw new Error(error.message || `Erreur API: ${res.status}`);
  }

  return res.json();
}

// ────────────────────────────────────────────────────────────
// Auth (cookies httpOnly)
// ────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  role: string;
  email: string;
  fullName: string;
  phone: string;
  country: string;
}

export interface AuthResponse {
  user: AuthUser;
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function register(data: {
  email: string;
  phone: string;
  password: string;
  fullName: string;
  country?: string;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function logout(): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('/v1/auth/logout', { method: 'POST' });
}

export function fetchMe(): Promise<AuthUser> {
  return apiFetch<AuthUser>('/v1/auth/me');
}

export interface PasswordResetRequestResponse {
  message: string;
  resetToken: string | null;
}

export function requestPasswordReset(email: string): Promise<PasswordResetRequestResponse> {
  return apiFetch<PasswordResetRequestResponse>('/v1/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/v1/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

// ────────────────────────────────────────────────────────────
// Plan de masse (public)
// ────────────────────────────────────────────────────────────

export interface SitePlanBlock {
  blockId: string;
  blockName: string;
  frontage: string;
  distanceFromEntranceM: number | null;
  sitePlanPolygon: { x: number; y: number }[] | null;
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
  const res = await fetch(`${API_BASE_URL}/v1/catalog/projects/${projectId}/site-plan`, {
    next: { revalidate: 30 }, // ISR : revalider toutes les 30s
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error(`Erreur API site-plan: ${res.status}`);
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
 * Authentification via cookie httpOnly (JwtStrategy lit access_token).
 */
export async function createReservation(unitId: string): Promise<ReservationResponse> {
  return apiFetch<ReservationResponse>('/v1/reservations', {
    method: 'POST',
    body: JSON.stringify({ unitId } satisfies ReservationRequest),
  });
}

// ────────────────────────────────────────────────────────────
// Suivi acquéreur
// ────────────────────────────────────────────────────────────

export interface PortalInstallment {
  id: string;
  label: string;
  amount: string;
  dueDate: string;
  status: string;
  paidAt: string | null;
}

export interface PortalDashboard {
  reservationId: string;
  status: string;
  unit: {
    id: string;
    name: string;
    type: string;
    surface: number;
    price: string;
    floor: number;
    block: { name: string; progressPercent: number; constructionPhase: string };
  };
  constructionProgress: number;
  constructionPhase: string;
  nextInstallment?: PortalInstallment | null;
}

export function fetchPortalDashboard(): Promise<PortalDashboard[]> {
  return apiFetch<PortalDashboard[]>('/v1/portal/dashboard');
}
