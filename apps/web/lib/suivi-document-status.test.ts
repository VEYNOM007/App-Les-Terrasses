import { describe, it, expect } from 'vitest';
import {
  isContractFinalized,
  isDocumentObsolete,
  suiviDocumentStatusLabel,
} from './suivi-document-status';
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
    buyerSigned: false,
    adminSigned: false,
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

describe('suiviDocumentStatusLabel — libellés /suivi acheteur (R6/C5)', () => {
  it('Palier 1 : acheteur signé → « Signé par vous — en attente de signature promoteur »', () => {
    const label = suiviDocumentStatusLabel(
      baseDocument({ buyerSigned: true, adminSigned: false }),
    );
    expect(label).toEqual({
      text: 'Signé par vous — en attente de signature promoteur',
      tone: 'sand',
    });
  });

  it('contrat entièrement signé → « Signé » (ton lagoon)', () => {
    const label = suiviDocumentStatusLabel(
      baseDocument({ buyerSigned: true, adminSigned: true }),
    );
    expect(label).toEqual({ text: 'Signé', tone: 'lagoon' });
  });

  it('aucune signature → « En attente de signature »', () => {
    const label = suiviDocumentStatusLabel(
      baseDocument({ buyerSigned: false, adminSigned: false }),
    );
    expect(label).toEqual({ text: 'En attente de signature', tone: 'inherit' });
  });

  it('réservation annulée → libellé d\'archive (obsolete prioritaire sur les signes)', () => {
    const label = suiviDocumentStatusLabel(
      baseDocument({
        reservationStatus: 'ANNULEE',
        buyerSigned: true,
        adminSigned: true,
      }),
    );
    expect(label).toEqual({ text: 'Réservation annulée — consultable aux archives', tone: 'laterite' });
  });
});

describe('isContractFinalized — contrat finalisé / PDF final (R6/C6)', () => {
  it('true quand les deux signataires ont signé et la réservation est active', () => {
    expect(
      isContractFinalized(baseDocument({ buyerSigned: true, adminSigned: true })),
    ).toBe(true);
  });

  it('false si un seul signataire a signé (Palier 1 ou 2)', () => {
    expect(
      isContractFinalized(baseDocument({ buyerSigned: true, adminSigned: false })),
    ).toBe(false);
    expect(
      isContractFinalized(baseDocument({ buyerSigned: false, adminSigned: true })),
    ).toBe(false);
  });

  it('false si la réservation est annulée (archive, même doublement signée)', () => {
    expect(
      isContractFinalized(
        baseDocument({
          reservationStatus: 'ANNULEE',
          buyerSigned: true,
          adminSigned: true,
        }),
      ),
    ).toBe(false);
  });
});
