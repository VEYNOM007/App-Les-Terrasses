import { readFile, rm } from 'fs/promises';
import * as path from 'path';
import { ContractPdfService } from './contract-pdf.service';
import { UPLOAD_ROOT } from '../../common/files/uploads.util';

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
});
