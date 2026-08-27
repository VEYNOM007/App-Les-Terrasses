import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAdminReservations, AdminReservation } from './api';

/**
 * R6 — Le filet qui manquait sur PR #69.
 *
 * fetchAdminReservations envoie la valeur `status` dans le query param.
 * Le backend valide via AdminListReservationsQueryDto `@IsIn(['en_attente',
 * 'confirmee', 'annulee', 'livree'])` (minuscules, contrat API OpenAPI).
 *
 * Le bug racine (statut envoyé en MAJUSCULES `EN_ATTENTE`) a causé une
 * erreur 400 au chargement de /admin/reservations. Ce test verrouille le
 * contrat : la fonction ne doit JAMAIS émettre un statut en majuscules.
 */
describe('fetchAdminReservations — contrat API status (R6)', () => {
  const originalFetch = global.fetch;
  const mockRow: AdminReservation = {
    id: 'res-1',
    status: 'EN_ATTENTE',
    lockExpiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
    createdAt: new Date().toISOString(),
    user: { id: 'u1', fullName: 'Test', email: 'test@example.com', phone: '0000' },
    unit: { id: 'unit-1', blockId: 'blk-1', type: 'T2', floor: 1 },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('devrait envoyer ?status=en_attente en minuscules (contrat API)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [mockRow],
    });
    global.fetch = fetchSpy;

    await fetchAdminReservations('en_attente');

    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/v1/admin/reservations?status=en_attente');
    expect(url).not.toContain('EN_ATTENTE');
    expect(options.credentials).toBe('include');
  });

  it('devrait couvrir les 4 statuts du contrat sans casse majuscule', async () => {
    const statuses = ['en_attente', 'confirmee', 'annulee', 'livree'];
    for (const s of statuses) {
      const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
      global.fetch = fetchSpy;
      await fetchAdminReservations(s);
      const [url] = fetchSpy.mock.calls[0] as [string];
      expect(url).toContain(`/v1/admin/reservations?status=${s}`);
      expect(url).toMatch(/status=[a-z_]+$/);
    }
  });

  it('NE DEVRAIT JAMAIS émettre de statut en majuscules (régression du bug)', async () => {
    // Le contrat exige le minuscule. Si le code courant passait 'EN_ATTENTE',
    // l'URL contiendrait une majuscule et cette assertion échouerait.
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    global.fetch = fetchSpy;

    await fetchAdminReservations('en_attente');

    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toContain('status=en_attente');
    expect(url).not.toContain('EN_ATTENTE');
    expect(url).not.toMatch(/[A-Z]/);
  });

  it('devrait construire Option sans query quand status est undefined', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    global.fetch = fetchSpy;

    await fetchAdminReservations();

    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toContain('/v1/admin/reservations');
    expect(url).not.toContain('status=');
  });

  it('devrait retourner les réservations (statuts majuscules en réponse)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => [mockRow] });
    global.fetch = fetchSpy;

    const result = await fetchAdminReservations('en_attente');
    expect(result).toHaveLength(1);
    // La VALUE DE REPONSE reste en majuscules (côté backend), c'est attendu.
    expect(result[0].status).toBe('EN_ATTENTE');
  });

  it('devrait propager une erreur API non-OK', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'status must be one of the following values' }),
    });
    global.fetch = fetchSpy;

    await expect(fetchAdminReservations('en_attente')).rejects.toThrow(
      'status must be one of the following values',
    );
  });
});
