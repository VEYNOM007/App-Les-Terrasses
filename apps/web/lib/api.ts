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
      // Un FormData (upload multipart) ne doit JAMAIS recevoir de Content-Type
      // JSON : le navigateur pose lui-même le boundary multipart.
      ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: `Erreur ${res.status}` }));
    throw new Error(error.message || `Erreur API: ${res.status}`);
  }

  // Réponse de succès sans corps (204 No Content, ou 2xx vide) : le handler
  // backend a retourné `undefined`. `res.json()` sur un corps vide lève
  // "Unexpected end of JSON input" — on retombe alors sur `undefined` (typé T
  // ou void) au lieu de planter.
  try {
    return await res.json();
  } catch {
    return undefined as T;
  }
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
  address?: string;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function setup(data: {
  email: string;
  phone: string;
  password: string;
  fullName: string;
  country?: string;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/v1/auth/setup', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function logout(): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('/v1/auth/logout', { method: 'POST' });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/v1/auth/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
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
  targetType: 'BLOCK' | 'UNIT';
  targetId: string;
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

export interface CatalogBlockHotspot {
  id: string;
  label: string;
  targetType: 'BLOCK' | 'UNIT';
  targetId: string;
  top: string;
  left: string;
}

export interface CatalogBlockView {
  id: string;
  title: string;
  category: 'masterplan' | 'aerial' | 'facade' | 'garden' | 'amenities';
  imageUrl: string;
  subtitle?: string;
  description?: string;
  hotspots?: CatalogBlockHotspot[];
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
  views: CatalogBlockView[] | null;
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

export interface AdminUnitMediaUpload {
  type: UnitMediaType;
  altText?: string;
  sortOrder?: number;
}

/**
 * Upload d'un fichier média (rendu 3D, photo, plan) vers le bucket public B2.
 * Envoi multipart : le fichier passe dans un FormData, le Content-Type est
 * posé automatiquement par le navigateur (boundary) — pas de header manuel.
 * Le serveur génère la clé interne et l'URL publique stable.
 */
export function uploadUnitMedia(
  unitId: string,
  body: AdminUnitMediaUpload,
  file: File,
): Promise<UnitMedia> {
  const formData = new FormData();
  formData.append('type', body.type);
  if (body.altText !== undefined) formData.append('altText', body.altText);
  if (body.sortOrder !== undefined) formData.append('sortOrder', String(body.sortOrder));
  formData.append('file', file);
  return apiFetch<UnitMedia>(`/v1/admin/units/${unitId}/media/upload`, {
    method: 'POST',
    body: formData,
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

// ────────────────────────────────────────────────────────────
// Vues par bloc (GET / PATCH / upload image)
// ────────────────────────────────────────────────────────────

/**
 * Récupère les vues d'un bloc (tableau de CatalogBlockView ou null
 * si le bloc n'a pas encore de vues configurées).
 */
export function adminGetBlockViews(blockId: string): Promise<CatalogBlockView[] | null> {
  return apiFetch<CatalogBlockView[] | null>(`/v1/admin/blocks/${blockId}/views`);
}

export interface AdminBlockUpdate {
  views: CatalogBlockView[];
}

/**
 * Remplace les vues d'un bloc (PATCH). Le DTO côté API valide le
 * format targetType/targetId — un ancien targetBlockId sera rejeté à 400.
 */
export function adminUpdateBlockViews(blockId: string, body: AdminBlockUpdate): Promise<{ views: CatalogBlockView[] }> {
  return apiFetch<{ views: CatalogBlockView[] }>(`/v1/admin/blocks/${blockId}/views`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/**
 * Upload d'une image de vue (plan de masse, vue aérienne, …) vers le
 * bucket B2 via l'endpoint bloc image. Même pattern que uploadUnitMedia.
 */
export function adminUploadBlockImage(blockId: string, file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch<{ url: string }>(`/v1/admin/blocks/${blockId}/image/upload`, {
    method: 'POST',
    body: formData,
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
  marketingDescription?: string;
  highlights?: string[];
  virtualTourUrl?: string;
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

export interface AdminReservation {
  id: string;
  status: 'EN_ATTENTE' | 'CONFIRMEE' | 'ANNULEE' | 'LIVREE';
  lockExpiresAt: string;
  createdAt: string;
  user: { id: string; fullName: string; email: string; phone: string };
  unit: { id: string; blockId: string; type: string; floor: number };
  // État du dernier contrat de la réservation (null/undefined = aucun). Sert au bouton
  // admin "Générer le contrat" pour déterminer le palier de sécurité.
  contract?: {
    id: string;
    buyerSigned: boolean;
    adminSigned: boolean;
  } | null;
}

export function fetchAdminReservations(status?: string): Promise<AdminReservation[]> {
  const qs = status ? `?status=${status}` : '';
  return apiFetch<AdminReservation[]>(`/v1/admin/reservations${qs}`);
}

/**
 * Modifie le statut d'une réservation côté back-office (réservé aux admins).
 * L'endpoint backend `PATCH /admin/reservations/:id/status` est déjà en place
 * (gardé par @Roles('ADMIN')) ; ce helper le rebranche à l'interface.
 * `status` suit le format API minuscules (ex. 'annulee' → ANNULEE + unité DISPONIBLE).
 */
export function updateAdminReservationStatus(
  reservationId: string,
  status: 'en_attente' | 'confirmee' | 'annulee' | 'livree',
): Promise<void> {
  return apiFetch<void>(`/v1/admin/reservations/${reservationId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

/**
 * (Règénère le contrat acheteur d'une réservation — réservé aux admins.
 * Le backend applique la garde en 3 paliers ; `force` est la confirmation
 * explicite du Palier 2 (remplacer un contrat déjà signé par l'admin).
 */
export function regenerateBuyerContract(
  reservationId: string,
  force: boolean,
): Promise<PortalDocument> {
  return apiFetch<PortalDocument>(`/v1/contracts/buyer/${reservationId}/regenerate`, {
    method: 'POST',
    body: JSON.stringify({ force }),
  });
}

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  country: string;
  address: string | null;
  role: 'ACHETEUR' | 'COMMERCIAL' | 'ADMIN' | 'ARTISAN';
  kycStatus: KycStatus;
  createdAt: string;
}

export function fetchAdminUsers(): Promise<AdminUser[]> {
  return apiFetch<AdminUser[]>('/v1/admin/clients');
}

export function updateUserAddress(userId: string, address: string | null): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/v1/admin/clients/${userId}/address`, {
    method: 'PATCH',
    body: JSON.stringify({ address }),
  });
}

export interface ReservationCreatePayload {
  reservation: ReservationResponse;
  schedule: { id: string };
}

/**
 * Crée une réservation (verrou 48h) sur une unité.
 * Authentification via cookie httpOnly (JwtStrategy lit access_token).
 * L'API retourne { reservation, schedule } — on extrait la réservation
 * pour maintenir la compatibilité avec les composants existants.
 */
export async function createReservation(unitId: string): Promise<ReservationResponse> {
  const payload = await apiFetch<ReservationCreatePayload>('/v1/reservations', {
    method: 'POST',
    body: JSON.stringify({ unitId } satisfies ReservationRequest),
  });
  return payload.reservation;
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
  createdAt: string;
  updatedAt: string;
  unit: {
    id: string;
    name: string;
    type: string;
    surface: number;
    price: string;
    floor: number;
    marketingDescription: string | null;
    highlights: string[];
    virtualTourUrl: string | null;
    media: UnitMedia[];
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

export interface PortalDocument {
  id: string;
  type: string;
  name: string;
  fileUrl: string;
  signedFileUrl: string | null;
  createdAt: string;
  reservationId: string | null;
  reservationStatus: string | null;
  // État des signatures agrégé côté serveur (portal /listDocuments) : permet
  // à /suivi d'afficher le bon libellé (en attente / Palier 1 / signé).
  buyerSigned: boolean;
  adminSigned: boolean;
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

// Téléchargement admin du contrat d'une réservation : route dédiée isolée
// sous @Roles('ADMIN'). Le document est vérifié rattaché à la réservation
// demandée côté serveur (isolation, pas de navigation transversale).
export async function adminDownloadContract(
  reservationId: string,
  documentId: string,
): Promise<DownloadDocumentResponse> {
  return apiFetch<DownloadDocumentResponse>(
    `/v1/admin/reservations/${reservationId}/documents/${documentId}/download`,
  );
}

export async function signContract(documentId: string, signatureBlob: Blob): Promise<PortalDocument> {
  const form = new FormData();
  form.append('signature', signatureBlob, 'signature.png');
  return apiFetch<PortalDocument>(`/v1/contracts/${documentId}/sign`, {
    method: 'POST',
    body: form,
  });
}

// ────────────────────────────────────────────────────────────
// Vérification d'identité (KYC)
// ────────────────────────────────────────────────────────────

export type KycStatus = 'NON_SOUMIS' | 'EN_ATTENTE' | 'VALIDE' | 'REJETE';

export type KycDocumentType = 'cni' | 'passeport' | 'carte_sejour';

export interface PortalKyc {
  kycStatus: KycStatus;
  latestDocument: {
    id: string;
    name: string;
    createdAt: string;
    rejectedAt: string | null;
    rejectedReason: string | null;
  } | null;
}

/**
 * Dossier KYC de l'acheteur courant : statut + dernière pièce (et son
 * motif de rejet pour la resoumission). Aucune clé B2 n'est exposée.
 */
export function fetchPortalKyc(): Promise<PortalKyc> {
  return apiFetch<PortalKyc>('/v1/portal/kyc');
}

/**
 * Soumission d'une pièce d'identité (multipart, guard JWT). L'API bascule
 * le compte en EN_ATTENTE ; une nouvelle soumission est possible après
 * rejet (le serveur lève 409 tant que la pièce précédente est en cours).
 */
export async function uploadKyc(
  file: Blob,
  documentType: KycDocumentType,
): Promise<{ id: string; kycStatus: KycStatus }> {
  const form = new FormData();
  form.append('file', file, file instanceof File ? file.name : 'piece.png');
  form.append('documentType', documentType);
  return apiFetch<{ id: string; kycStatus: KycStatus }>('/v1/auth/kyc', {
    method: 'POST',
    body: form,
  });
}

// ── Côté admin (revue des dossiers KYC) ─────────────────────

export interface AdminKycEntry {
  id: string;
  fullName: string;
  email: string;
  kycStatus: KycStatus;
  updatedAt: string;
  documentCount: number;
  latestDocument: {
    id: string;
    name: string;
    createdAt: string;
    rejectedAt: string | null;
    rejectedReason: string | null;
  } | null;
}

export function fetchAdminKyc(): Promise<AdminKycEntry[]> {
  return apiFetch<AdminKycEntry[]>('/v1/admin/kyc');
}

export async function fetchKycDocumentUrl(documentId: string): Promise<{ url: string }> {
  return apiFetch<{ url: string }>(`/v1/admin/kyc/${documentId}/file`);
}

export async function approveKyc(
  documentId: string,
): Promise<{ documentId: string; kycStatus: KycStatus }> {
  return apiFetch<{ documentId: string; kycStatus: KycStatus }>(
    `/v1/admin/kyc/${documentId}/approve`,
    { method: 'POST' },
  );
}

export async function rejectKyc(
  documentId: string,
  reason: string,
): Promise<{ documentId: string; kycStatus: KycStatus }> {
  return apiFetch<{ documentId: string; kycStatus: KycStatus }>(
    `/v1/admin/kyc/${documentId}/reject`,
    { method: 'POST', body: JSON.stringify({ reason }) },
  );
}

// ────────────────────────────────────────────────────────────
// Paiement (Stripe uniquement)
// ────────────────────────────────────────────────────────────

export interface PayInstallmentResponse {
  paymentUrl: string;
  transactionId: string;
  provider: 'STRIPE';
  sessionId?: string;
}

export interface PaymentScheduleResponse {
  reservationId: string;
  totalAmount: string;
  currency: string;
  installments: PortalInstallment[];
}

export interface PaymentHistoryItem {
  id: string;
  scheduleId: string;
  label: string;
  amount: string;
  dueDate: string;
  status: 'EN_ATTENTE' | 'PAYE' | 'EN_RETARD' | 'ANNULE' | string;
  paidAt: string | null;
  provider: 'CINETPAY' | 'STRIPE' | 'MOBILE_MONEY' | 'VIREMENT_BANCAIRE' | 'AUTRE' | null;
  providerRef: string | null;
  createdAt: string;
  updatedAt: string;
  schedule: {
    reservation: {
      id: string;
      unitId: string;
    };
  };
}

/**
 * Initie le paiement d'une échéance auprès du provider choisi.
 * Périmètre strict du chantier actif : Stripe (mode test) uniquement.
 */
export function payInstallment(
  installmentId: string,
  provider: 'STRIPE' = 'STRIPE',
): Promise<PayInstallmentResponse> {
  return apiFetch<PayInstallmentResponse>(`/v1/payments/installments/${installmentId}/pay`, {
    method: 'POST',
    body: JSON.stringify({ provider }),
  });
}

/**
 * Récupère l'échéancier complet d'une réservation pour l'acheteur connecté.
 */
export function fetchPaymentSchedule(reservationId: string): Promise<PaymentScheduleResponse> {
  return apiFetch<PaymentScheduleResponse>(`/v1/payments/schedule/${reservationId}`);
}

/**
 * Récupère l'historique complet des paiements de l'acheteur connecté.
 * Alignement 1:1 sur la réponse de GET /v1/payments/history (NestJS/Prisma).
 */
export function fetchPaymentHistory(): Promise<PaymentHistoryItem[]> {
  return apiFetch<PaymentHistoryItem[]>('/v1/payments/history');
}

/**
 * Annule la réservation de l'acheteur connecté (statut EN_ATTENTE uniquement,
 * contrôle côté backend : propriétaire + transition autorisée).
 * L'échéancier existant n'est pas supprimé ; l'unité est re-libérée.
 */
export function cancelReservation(reservationId: string): Promise<void> {
  return apiFetch<void>(`/v1/reservations/${reservationId}`, { method: 'DELETE' });
}

