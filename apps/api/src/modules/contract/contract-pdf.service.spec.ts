import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import * as path from 'path';
import { ContractPdfService } from './contract-pdf.service';
import { UPLOAD_ROOT } from '../../common/files/uploads.util';

// PNG 1x1 RGBA minimal — valide pour pdf-lib embedPng.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('ContractPdfService', () => {
  const service = new ContractPdfService();
  const generatedFiles: string[] = [];

  afterEach(async () => {
    await Promise.all(generatedFiles.splice(0).map((file) => rm(file, { force: true })));
  });

  it('génère un vrai PDF dans le stockage des contrats', async () => {
    const fileUrl = await service.generate({
      title: 'Contrat de test',
      reference: 'contract-test-1',
      sections: [
        { heading: 'Parties', lines: ['Acheteur : Kofi Mensah', 'Projet : Résidence Test'] },
      ],
    });

    expect(fileUrl).toMatch(/^\/uploads\/contracts\/[0-9a-f-]+\.pdf$/);
    const absolutePath = path.join(UPLOAD_ROOT, 'contracts', path.basename(fileUrl));
    generatedFiles.push(absolutePath);

    const content = await readFile(absolutePath);
    expect(content.subarray(0, 5).toString()).toBe('%PDF-');
    expect(content.length).toBeGreaterThan(500);
  });

  it('contresigne un PDF existant avec les images de signature', async () => {
    const originalUrl = await service.generate({
      title: 'Contrat à signer',
      reference: 'contract-sign-1',
      sections: [{ heading: 'Parties', lines: ['Acheteur : Kofi Mensah'] }],
    });
    generatedFiles.push(path.join(UPLOAD_ROOT, 'contracts', path.basename(originalUrl)));

    const signatureDirectory = path.join(UPLOAD_ROOT, 'signatures');
    await mkdir(signatureDirectory, { recursive: true });
    const signatureUrl = '/uploads/signatures/signature-test.png';
    const signaturePath = path.join(signatureDirectory, 'signature-test.png');
    await writeFile(signaturePath, PNG_1X1);
    generatedFiles.push(signaturePath);

    const signedUrl = await service.sign(originalUrl, [
      { label: 'Propriétaire', imageUrl: signatureUrl },
    ]);
    generatedFiles.push(path.join(UPLOAD_ROOT, 'contracts', path.basename(signedUrl)));

    expect(signedUrl).toMatch(/^\/uploads\/contracts\/[0-9a-f-]+\.pdf$/);
    expect(signedUrl).not.toBe(originalUrl);

    const content = await readFile(path.join(UPLOAD_ROOT, 'contracts', path.basename(signedUrl)));
    expect(content.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
