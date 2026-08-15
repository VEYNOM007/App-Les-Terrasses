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

export interface CatalogProjectHotspot {
  id: string;
  label: string;
  targetBlockId: string;
  top: string;
  left: string;
}

export interface CatalogProjectView {
  id: string;
  title: string;
  subtitle: string;
  category: 'masterplan' | 'aerial' | 'facade' | 'garden' | 'amenities';
  imageUrl: string;
  description: string;
  hotspots?: CatalogProjectHotspot[];
}

export interface CatalogProjectMarketingInfo {
  name?: string;
  location?: string;
  titleDeed?: string;
  totalLandArea?: string;
  deliveryDate?: string;
  notaryName?: string;
  escrowBank?: string;
}

export interface CatalogProjectUnit {
  id: string;
  type: UnitType;
  status: UnitStatus;
}

export interface CatalogProjectBlock {
  id: string;
  name: string;
  units: CatalogProjectUnit[];
}

export interface CatalogProject {
  id: string;
  name: string;
  location: string;
  description: string | null;
  siteMapImageUrl: string | null;
  marketingInfo: CatalogProjectMarketingInfo | null;
  views: CatalogProjectView[] | null;
  blocks: CatalogProjectBlock[];
}

export function fetchCatalogProjects(): Promise<CatalogProject[]> {
  return apiFetch<CatalogProject[]>('/v1/catalog/projects');
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
// Catalogue (public)
// ────────────────────────────────────────────────────────────

export type UnitType = 'STUDIO' | 'T2' | 'T3' | 'T4' | 'T5' | 'COMMERCE';
export type UnitStatus = 'DISPONIBLE' | 'RESERVE' | 'VENDU' | 'LIVRE' | 'ARCHIVE';
export type UnitMediaType = 'PHOTO' | 'PHOTO_REELLE' | 'PLAN' | 'RENDU_3D';

export interface TypologyUnit {
  id: string;
  blockName: string;
  blockFrontage: string;
  floor: number;
  surface: number;
  price: string;
  status: UnitStatus;
  hasRendu3D: boolean;
}

export interface TypologyGroup {
  type: UnitType;
  totalUnits: number;
  availableUnits: number;
  minPrice: string;
  units: TypologyUnit[];
}

export interface UnitMedia {
  id: string;
  type: UnitMediaType;
  url: string;
  altText: string;
  sortOrder: number;
}

export interface CatalogUnit {
  id: string;
  type: UnitType;
  surface: number;
  floor: number;
  price: string;
  status: UnitStatus;
  currency: string;
  planImage: string | null;
  virtualTourUrl: string | null;
  marketingDescription: string | null;
  highlights: string[];
  block: { name: string; frontage: string };
  media: UnitMedia[];
}

/**
 * Agrégats par typologie (compteurs, prix mini, unités) pour la grille du
 * catalogue. Endpoint public — les prix Prisma Decimal arrivent en string.
 */
export function fetchTypologies(): Promise<TypologyGroup[]> {
  return apiFetch<TypologyGroup[]>('/v1/catalog/typologies');
}

/**
 * Fiche unité individuelle (médias ordonnés) pour l'unité représentative.
 * Endpoint public — fonctionne aussi sur une unité vendue.
 */
export function fetchUnit(id: string): Promise<CatalogUnit> {
  return apiFetch<CatalogUnit>(`/v1/catalog/units/${id}`);
}

export interface PaymentInstallment {
  label: string;
  amount: string;
  dueDate: string;
  percent: number;
}

export interface PaymentPreview {
  unitId: string;
  unitType: UnitType;
  totalAmount: string;
  currency: string;
  downPaymentPercent: number;
  installments: PaymentInstallment[];
}

/**
 * Aperçu public de l'échéancier VEFA (acompte + tranches d'équilibre).
 * `downPaymentPercent` facultatif : l'API applique l'acompte par défaut du
 * projet si absent. Les montants Prisma Decimal arrivent en string.
 */
export function fetchPaymentPreview(
  unitId: string,
  downPaymentPercent?: number,
): Promise<PaymentPreview> {
  const query =
    downPaymentPercent === undefined ? '' : `?downPaymentPercent=${downPaymentPercent}`;
  return apiFetch<PaymentPreview>(`/v1/catalog/units/${unitId}/payment-preview${query}`);
}

// ────────────────────────────────────────────────────────────
// Administration (catalogue) — cookie admin requis (RolesGuard)
// ────────────────────────────────────────────────────────────

export interface AdminUnitUpdate {
  type?: UnitType;
  surface?: number;
  floor?: number;
  price?: number;
  currency?: string;
  planImage?: string;
  marketingDescription?: string;
  highlights?: string[];
  virtualTourUrl?: string;
  status?: UnitStatus;
  hasStorefront?: boolean;
  streetFacing?: boolean;
}

export interface AdminUnitMediaCreate {
  type: UnitMediaType;
  url: string;
  altText?: string;
  sortOrder?: number;
}

export interface AdminUnitMediaUpdate {
  type?: UnitMediaType;
  url?: string;
  altText?: string;
  sortOrder?: number;
}

/**
 * Édition d'une unité existante (prix, statut, surfaces…).
 * Corps aligné sur `UpdateUnitDto` (PartialType de CreateUnitDto) — toutes
 * les propriétés sont optionnelles, `price` en number (Decimal en base).
 */
export function adminUpdateUnit(id: string, body: AdminUnitUpdate): Promise<CatalogUnit> {
  return apiFetch<CatalogUnit>(`/v1/admin/units/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/**
 * Ajout d'un média à une unité (rendu 3D, plan, photo).
 * Corps aligné sur `CreateUnitMediaDto` — `type` parmi RENDU_3D, PHOTO,
 * PHOTO_REELLE, PLAN.
 */
export function adminAddUnitMedia(unitId: string, body: AdminUnitMediaCreate): Promise<UnitMedia> {
  return apiFetch<UnitMedia>(`/v1/admin/units/${unitId}/media`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Édition d'un média (type, ordre d'affichage, URL).
 * Corps aligné sur `UpdateUnitMediaDto` (PartialType de CreateUnitMediaDto).
 */
export function adminUpdateMedia(mediaId: string, body: AdminUnitMediaUpdate): Promise<UnitMedia> {
  return apiFetch<UnitMedia>(`/v1/admin/media/${mediaId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function adminDeleteMedia(mediaId: string): Promise<{ message?: string }> {
  return apiFetch<{ message?: string }>(`/v1/admin/media/${mediaId}`, {
    method: 'DELETE',
  });
}

// ────────────────────────────────────────────────────────────
// Administration (blocs & création / suppression d'unités)
// ────────────────────────────────────────────────────────────

/**
 * Unité telle que renvoyée par GET /admin/projects — tous statuts inclus
 * (dont ARCHIVE), contrairement au catalogue public qui les exclut.
 * `price` arrive en string (Decimal Prisma serialisé).
 */
export interface AdminProjectUnit {
  id: string;
  type: UnitType;
  surface: number;
  floor: number;
  price: string;
  currency: string;
  planImage: string | null;
  virtualTourUrl: string | null;
  marketingDescription: string | null;
  highlights: string[];
  status: UnitStatus;
  media: UnitMedia[];
}

export interface AdminBlock {
  id: string;
  name: string;
  floors: number;
  frontage: string;
  units: AdminProjectUnit[];
}

export interface AdminProject {
  id: string;
  name: string;
  location: string;
  description: string | null;
  siteMapImageUrl: string | null;
  marketingInfo: CatalogProjectMarketingInfo | null;
  views: CatalogProjectView[] | null;
  status: string;
  blocks: AdminBlock[];
}

/**
 * Liste les projets admin (inclut les BROUILLON, contrairement au catalogue
 * public) avec leurs blocs réels — alimente le dropdown de choix bloc à
 * l'ajout d'une unité (les `id` font foi, pas les noms libres).
 */
export function fetchAdminProjects(): Promise<AdminProject[]> {
  return apiFetch<AdminProject[]>('/v1/admin/projects');
}

export interface AdminProjectUpdate {
  name?: string;
  location?: string;
  description?: string;
  siteMapImageUrl?: string;
  marketingInfo?: CatalogProjectMarketingInfo;
  views?: CatalogProjectView[];
}

export function adminUpdateProject(id: string, body: AdminProjectUpdate): Promise<AdminProject> {
  return apiFetch<AdminProject>(`/v1/admin/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export interface AdminUnitCreate {
  blockId: string;
  type: UnitType;
  surface: number;
  floor: number;
  price: number;
  currency?: string;
  status?: UnitStatus;
}

/**
 * Création d'une unité dans un bloc réel. Corps aligné sur `CreateUnitDto` :
 * `blockId` requis — jamais de nom libre côté client. Le endpoint renvoie
 * l'unité brute (pas le shape enrichi `CatalogUnit`) : seule `id` est garantie.
 */
export function adminCreateUnit(body: AdminUnitCreate): Promise<{ id: string }> {
  return apiFetch<{ id: string }>('/v1/admin/units', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Suppression SQL réelle d'une unité — filet de sécurité rare. L'API répond
 * 409 si l'unité a le moindre historique de réservation (même annulée) :
 * dans ce cas il faut archiver (`adminUpdateUnit(id, { status: 'ARCHIVE' })`).
 */
export function adminDeleteUnit(id: string): Promise<{ message?: string }> {
  return apiFetch<{ message?: string }>(`/v1/admin/units/${id}`, {
    method: 'DELETE',
  });
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

// ────────────────────────────────────────────────────────────
// Documents & contrats
// ────────────────────────────────────────────────────────────

export interface ContractSignature {
  id: string;
  signerType: 'PROPRIETAIRE' | 'ADMIN';
  signatureImageUrl: string;
  signedAt: string;
}

export interface PortalDocument {
  id: string;
  type: string;
  name: string;
  fileUrl: string;
  signedFileUrl: string | null;
  createdAt: string;
  signatures?: ContractSignature[];
}

export function fetchPortalDocuments(): Promise<PortalDocument[]> {
  return apiFetch<PortalDocument[]>('/v1/portal/documents');
}

export interface DownloadDocumentResponse {
  downloadUrl: string;
}

/**
 * Renvoie une URL signée (B2) à durée limitée pour télécharger le document.
 * Le navigateur télécharge directement depuis B2 — l'API ne proxie jamais
 * le fichier. L'appartenance du document est vérifiée côté serveur.
 */
export async function downloadDocument(documentId: string): Promise<DownloadDocumentResponse> {
  return apiFetch<DownloadDocumentResponse>(`/v1/portal/documents/${documentId}/download`);
}

export async function signContract(documentId: string, signatureBlob: Blob): Promise<PortalDocument> {
  const form = new FormData();
  form.append('signature', signatureBlob, 'signature.png');
  return apiFetch<PortalDocument>(`/v1/contracts/${documentId}/sign`, {
    method: 'POST',
    body: form,
  });
}
