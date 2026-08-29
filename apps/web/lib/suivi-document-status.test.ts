import { describe, it, expect } from 'vitest';
import { isDocumentObsolete } from './suivi-document-status';
import { PortalDocument } from './api';

function baseDocument(overrides: Partial<PortalDocument>): PortalDocument {
  return {
    id: 'doc-1',
    type: 'CONTRAT',
    name: 'Contrat Studio',
    fileUrl: 'contracts/original.pdf',
    signedFileUrl: null,
    createdAt: '2026-07-01T08:00:00.000Z',
    reservationId: 'resa-1',
    reservationStatus: 'CONFIRMEE',
    ...overrides,
  };
}

describe('isDocumentObsolete — document de réservation annulée (R6)', () => {
  it('reconnaît un document lié à une réservation ANNULÉE comme obsolète', () => {
    expect(isDocumentObsolete(baseDocument({ reservationStatus: 'ANNULEE' }))).toBe(true);
  });

  it('reconnaît un document de réservation active comme non obsolète', () => {
    expect(isDocumentObsolete(baseDocument({ reservationStatus: 'CONFIRMEE' }))).toBe(false);
    expect(isDocumentObsolete(baseDocument({ reservationStatus: 'EN_ATTENTE' }))).toBe(false);
    expect(isDocumentObsolete(baseDocument({ reservationStatus: 'LIVREE' }))).toBe(false);
  });

  it('reconnaît un document sans réservation (artisan) comme non obsolète', () => {
    expect(
      isDocumentObsolete(baseDocument({ reservationId: null, reservationStatus: null })),
    ).toBe(false);
  });
});
