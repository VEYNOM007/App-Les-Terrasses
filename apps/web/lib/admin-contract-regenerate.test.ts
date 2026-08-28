import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { regenerateBuyerContract } from './api';

/**
 * R6 — Contrat API du bouton admin "Générer le contrat".
 *
 * regenerateBuyerContract doit :
 *  - appeler POST /v1/contracts/buyer/:reservationId/regenerate
 *  - envoyer `{ force }` dans le corps (la confirmation explicite du Palier 2)
 *  - utiliser les credentials `include` (cookie httpOnly JWT).
 */
describe('regenerateBuyerContract — contrats API (R6)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('devrait POST sur la route /regenerate avec force=false (Palier 3)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'doc-1', type: 'CONTRAT' }),
    });
    global.fetch = fetchSpy;

    await regenerateBuyerContract('res-1', false);

    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/v1/contracts/buyer/res-1/regenerate');
    expect(options.method).toBe('POST');
    expect(options.credentials).toBe('include');
    expect(JSON.parse(String(options.body))).toEqual({ force: false });
  });

  it('devrait envoyer force=true quand l\'admin confirme le Palier 2', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'doc-2', type: 'CONTRAT' }),
    });
    global.fetch = fetchSpy;

    await regenerateBuyerContract('res-2', true);

    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/v1/contracts/buyer/res-2/regenerate');
    expect(JSON.parse(String(options.body))).toEqual({ force: true });
  });

  it('devrait propager une erreur API non-OK (ex: 409 Palier 1)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Le contrat est déjà signé par le propriétaire' }),
    });
    global.fetch = fetchSpy;

    await expect(regenerateBuyerContract('res-3', false)).rejects.toThrow(
      'Le contrat est déjà signé par le propriétaire',
    );
  });
});
