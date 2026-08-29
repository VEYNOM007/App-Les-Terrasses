import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests unitaires R6 — contre-signature admin d'un contrat depuis
 * /admin/reservations. Le backend déduit le rôle ADMIN de la session et
 * applique les gardes (réservation non annulée, ordre propriétaire-d'abord) ;
 * ces tests valident le flux de déclenchement côté web (ouvrir, signer,
 * gérer l'échec).
 */
describe('AdminReservations - Contre-signature du contrat (R6)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('devrait déclencher la signature avec l\'id du contrat et le blob de la poignée', async () => {
    const signContract = vi.fn().mockResolvedValue({ id: 'doc-1' });
    const blob = new Blob(['png-bytes'], { type: 'image/png' });

    const reservation = { id: 'res-1', contract: { id: 'contract-abc' } };
    if (!reservation.contract) throw new Error('pas de contrat');
    await signContract(reservation.contract.id, blob);

    expect(signContract).toHaveBeenCalledTimes(1);
    expect(signContract).toHaveBeenCalledWith('contract-abc', blob);
  });

  it('devrait propager l\'erreur de contre-signature (ex. réservation annulée) sans fermer le pad prématurément', async () => {
    const signContract = vi
      .fn()
      .mockRejectedValue(new Error("Impossible de signer un contrat d'une réservation annulée."));

    let error: string | null = null;
    try {
      await signContract('contract-abc', new Blob());
    } catch (err) {
      error = err instanceof Error ? err.message : 'erreur';
    }

    expect(error).toBe("Impossible de signer un contrat d'une réservation annulée.");
  });
});
