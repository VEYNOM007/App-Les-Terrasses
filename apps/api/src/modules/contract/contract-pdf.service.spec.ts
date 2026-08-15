import { Test, TestingModule } from '@nestjs/testing';
import { ContractPdfService } from './contract-pdf.service';
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
      { label: 'Propriétaire', imageUrl: signatureKey },
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
});
