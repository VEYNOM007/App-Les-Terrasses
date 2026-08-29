import { Test, TestingModule } from '@nestjs/testing';
import { PDFDocument } from 'pdf-lib';
import {
  ContractPdfService,
  signatureBandLayout,
  formatSignatureDate,
  buildSignatureCaption,
  MARGIN,
} from './contract-pdf.service';
import { StorageService } from '../../common/storage/storage.service';

// PNG 1x1 RGBA minimal — valide pour pdf-lib embedPng.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const createMockStorage = () => ({
  putObject: jest.fn(),
  getObject: jest.fn(),
  getSignedUrl: jest.fn(),
  deleteObject: jest.fn(),
});

describe('ContractPdfService', () => {
  let service: ContractPdfService;
  let storage: ReturnType<typeof createMockStorage>;

  beforeEach(async () => {
    storage = createMockStorage();
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContractPdfService, { provide: StorageService, useValue: storage }],
    }).compile();
    service = module.get(ContractPdfService);
  });

  it('génère un vrai PDF et le dépose sur B2 sous une clé interne contracts/<uuid>.pdf', async () => {
    storage.putObject.mockResolvedValue(undefined);

    const key = await service.generate({
      title: 'Contrat de test',
      reference: 'contract-test-1',
      sections: [
        { heading: 'Parties', lines: ['Acheteur : Kofi Mensah', 'Projet : Résidence Test'] },
      ],
    });

    expect(key).toMatch(/^contracts\/[0-9a-f-]+\.pdf$/);
    expect(storage.putObject).toHaveBeenCalledTimes(1);
    const [putKey, body, contentType] = storage.putObject.mock.calls[0];
    expect(putKey).toBe(key);
    expect(body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(body.length).toBeGreaterThan(500);
    expect(contentType).toBe('application/pdf');
  });

  it('contresigne un PDF existant : lit l\'original + PNG depuis B2, dépose la copie signée', async () => {
    const originalKey = await service.generate({
      title: 'Contrat à signer',
      reference: 'contract-sign-1',
      sections: [{ heading: 'Parties', lines: ['Acheteur : Kofi Mensah'] }],
    });
    const [, originalBody] = storage.putObject.mock.calls[0];

    const signatureKey = 'signatures/signature-test.png';
    storage.getObject.mockImplementation(async (key: string) => {
      if (key === signatureKey) return { body: PNG_1X1, contentType: 'image/png' };
      if (key === originalKey) return { body: originalBody, contentType: 'application/pdf' };
      throw new Error(`Clé inattendue dans le mock : ${key}`);
    });

    const signedKey = await service.sign(originalKey, [
      { label: 'Propriétaire', imageUrl: signatureKey, signedAt: '2026-08-29T09:00:00.000Z' },
    ]);

    expect(signedKey).toMatch(/^contracts\/[0-9a-f-]+\.pdf$/);
    expect(signedKey).not.toBe(originalKey);

    // L'original et le PNG ont été lus depuis B2
    expect(storage.getObject).toHaveBeenCalledWith(originalKey);
    expect(storage.getObject).toHaveBeenCalledWith(signatureKey);

    // La copie signée est un vrai PDF déposé à part
    expect(storage.putObject).toHaveBeenCalledTimes(2);
    const [signedPutKey, signedBody] = storage.putObject.mock.calls[1];
    expect(signedPutKey).toBe(signedKey);
    expect(signedBody.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('pose les signatures sur une page dédiée, même quand la dernière page du contrat est saturée (jamais de chevauchement)', async () => {
    // Dernière page volontairement saturée : 150 lignes de corps → le contrat
    // fait plusieurs pages pleines. Les signatures doivent aller sur une page
    // finale dédiée (+1 page), jamais au bas d'une page de contenu.
    const longLines = Array.from(
      { length: 150 },
      (_, i) => `Ligne de corps ${i + 1} — contenu du contrat pour saturer la page.`,
    );
    const originalKey = await service.generate({
      title: 'Contrat à signer',
      reference: 'contract-full-1',
      sections: [{ heading: 'Parties', lines: longLines }],
    });
    const [, originalBody] = storage.putObject.mock.calls[0];
    const originalDoc = await PDFDocument.load(originalBody);

    const sigA = 'signatures/sig-a.png';
    const sigB = 'signatures/sig-b.png';
    storage.getObject.mockImplementation(async (key: string) => {
      if (key === sigA || key === sigB) return { body: PNG_1X1, contentType: 'image/png' };
      if (key === originalKey) return { body: originalBody, contentType: 'application/pdf' };
      throw new Error(`Clé inattendue dans le mock : ${key}`);
    });

    const signedKey = await service.sign(originalKey, [
      { label: 'Propriétaire', imageUrl: sigA, signedAt: '2026-08-29T09:00:00.000Z' },
      { label: 'Administration', imageUrl: sigB, signedAt: '2026-08-29T14:30:00.000Z' },
    ]);

    const signedBody = storage.putObject.mock.calls[1][1];
    const signedDoc = await PDFDocument.load(signedBody);
    expect(signedDoc.getPageCount()).toBe(originalDoc.getPageCount() + 1);
    expect(signedKey).not.toBe(originalKey);
    expect(signedBody.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('signatureBandLayout — géométrie bornée (R6)', () => {
  // Dimensions A4 (les mêmes que celles injectées par sign()).
  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;

  it.each([1, 2, 3])('commet %i signature(s) restent dans les limites de la page (aucune coordonnée négative/hors zone)', (count) => {
    const layout = signatureBandLayout(PAGE_WIDTH, PAGE_HEIGHT, count);

    for (const p of layout.placements) {
      expect(p.x).toBeGreaterThanOrEqual(MARGIN);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + p.width).toBeLessThanOrEqual(PAGE_WIDTH - MARGIN);
      expect(p.y + p.height).toBeLessThanOrEqual(PAGE_HEIGHT);
      expect(p.width).toBeGreaterThan(0);
      expect(p.height).toBeGreaterThan(0);
    }

    // Titre, étiquettes et mention de date dans la page.
    expect(layout.headingY).toBeGreaterThanOrEqual(0);
    expect(layout.headingY).toBeLessThanOrEqual(PAGE_HEIGHT);
    expect(layout.labelBaselineY).toBeGreaterThanOrEqual(0);
    expect(layout.dateBaselineY).toBeGreaterThanOrEqual(0);
  });

  it('espace les boîtes : aucun chevauchement horizontal entre signataires (2 et 3 signatures)', () => {
    for (const count of [2, 3]) {
      const { placements } = signatureBandLayout(PAGE_WIDTH, PAGE_HEIGHT, count);
      for (let i = 1; i < placements.length; i += 1) {
        const previous = placements[i - 1];
        const current = placements[i];
        expect(current.x).toBeGreaterThanOrEqual(previous.x + previous.width);
      }
    }
  });

  it('rejette un appel sans signataire (défensif)', () => {
    expect(() => signatureBandLayout(PAGE_WIDTH, PAGE_HEIGHT, 0)).toThrow();
  });
});

describe('formatSignatureDate (R6)', () => {
  it('formate en lecture humaine locale, jamais en ISO brut', () => {
    // 2026-08-29T09:00:00Z — heure locale machine ; on vérifie la forme et la
    // date, pas l'heure exacte (fuseau machine non fiable en CI).
    const formatted = formatSignatureDate('2026-08-29T09:00:00.000Z');
    expect(formatted).toMatch(/^\d{2}\/\d{2}\/\d{4} à \d{2}h\d{2}$/);
    expect(formatted).toContain('29/08/2026 à ');
    expect(formatted).not.toContain('T');
    expect(formatted).not.toContain('Z');
  });

  it('préserve la date locale précise (après-midi)', () => {
    const formatted = formatSignatureDate('2026-08-29T14:30:00.000Z');
    expect(formatted).toMatch(/^\d{2}\/\d{2}\/\d{4} à \d{2}h\d{2}$/);
    expect(formatted).toContain('29/08/2026 à ');
  });
});

describe('buildSignatureCaption — date propre à chaque signataire (R6)', () => {
  it('affiche la date DE la signature du signataire, pas une date générique commune', () => {
    const propositaire = buildSignatureCaption('Propriétaire', '2026-08-29T09:00:00.000Z');
    const administration = buildSignatureCaption('Administration', '2026-08-29T14:30:00.000Z');
    expect(propositaire).toContain('Propriétaire — signé le 29/08/2026');
    expect(administration).toContain('Administration — signé le 29/08/2026');
    // Deux signataires différents → deux mentions distinctes (jamais dupliquées).
    expect(propositaire).not.toBe(administration);
    expect(propositaire).not.toContain('Administration');
    expect(administration).not.toContain('Propriétaire');
  });

  it('ne produit jamais d’ISO brut dans la mention', () => {
    const caption = buildSignatureCaption('Propriétaire', '2026-08-29T09:00:00.000Z');
    expect(caption).not.toMatch(/T\d{2}:/);
    expect(caption).not.toContain('Z');
  });
});;
