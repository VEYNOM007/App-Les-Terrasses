import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { updateAdminReservationStatus } from './api';

/**
 * R6 — API du bouton admin "Annuler la réservation".
 *
 * updateAdminReservationStatus doit :
 *  - appeler PATCH /v1/admin/reservations/:reservationId/status
 *  - envoyer `{ status: 'annulee' }` dans le corps (le backend fait alors
 *    réservation → ANNULEE + unité → DISPONIBLE)
 *  - utiliser les credentials `include` (cookie httpOnly JWT) et un body JSON.
 */
describe('updateAdminReservationStatus — annulation réservation (R6)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('devrait PATCH la route /status avec { status: "annulee" }', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    global.fetch = fetchSpy;

    await updateAdminReservationStatus('res-1', 'annulee');

    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/v1/admin/reservations/res-1/status');
    expect(options.method).toBe('PATCH');
    expect(options.credentials).toBe('include');
    expect(JSON.parse(String(options.body))).toEqual({ status: 'annulee' });
  });

  it('devrait propager une erreur API non-OK', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Seul un administrateur peut modifier ce statut.' }),
    });
    global.fetch = fetchSpy;

    await expect(updateAdminReservationStatus('res-2', 'annulee')).rejects.toThrow(
      'Seul un administrateur peut modifier ce statut.',
    );
  });
});
