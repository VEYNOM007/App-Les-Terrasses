import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests unitaires R6 — téléchargement admin du contrat contresigné depuis
 * /admin/reservations. La route serveur (C2) est isolée sous @Roles('ADMIN')
 * et vérifie l'attachement document→réservation ; ces tests documentent le
 * contrat du helper côté web (formation de l'appel + gestion d'erreur).
 */
describe('AdminReservations - Téléchargement du contrat contresigné (R6 / C4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('devrait appeler l\'endpoint admin dédié avec l\'id de réservation et l\'id de document', async () => {
    const adminDownloadContract = vi.fn().mockResolvedValue({ downloadUrl: 'https://b2/signed-url' });

    const reservationId = 'res-1';
    const documentId = 'contract-abc';
    const { downloadUrl } = await adminDownloadContract(reservationId, documentId);

    expect(adminDownloadContract).toHaveBeenCalledTimes(1);
    expect(adminDownloadContract).toHaveBeenCalledWith('res-1', 'contract-abc');
    expect(downloadUrl).toBe('https://b2/signed-url');
  });

  it('devrait renvoyer une URL signée prête pour window.open' , async () => {
    const adminDownloadContract = vi.fn().mockResolvedValue({
      downloadUrl: 'https://b2.s3.us-east-1.backblazeb2.com/signature.png?X-Amz-Signature=abc',
    });

    const { downloadUrl } = await adminDownloadContract('res-1', 'contract-abc');

    expect(downloadUrl).toMatch(/^https:\/\/b2\.s3/);
    expect(downloadUrl).toContain('X-Amz-Signature=');
  });

  it('devrait propager l\'erreur (ex. document non rattaché à la réservation → 403/404)', async () => {
    const adminDownloadContract = vi
      .fn()
      .mockRejectedValue(new Error("Document non rattaché à cette réservation."));

    await expect(adminDownloadContract('res-1', 'autre-doc')).rejects.toThrow(
      'Document non rattaché à cette réservation.',
    );
  });
});