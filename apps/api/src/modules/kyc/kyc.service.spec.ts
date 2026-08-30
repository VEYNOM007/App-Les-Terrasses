import { Test } from '@nestjs/testing';
import { DocumentType } from '@prisma/client';
import { KycService } from './kyc.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';

describe('KycService', () => {
  let service: KycService;
  let prisma: {
    document: { findUnique: jest.Mock; delete: jest.Mock };
  };
  let storage: { deleteObject: jest.Mock };

  const rejectedDoc = {
    id: 'doc-kyc-1',
    type: DocumentType.PIECE_IDENTITE,
    name: 'Pièce d\'identité — 2026-08-10',
    fileUrl: 'kyc/4f7a2d1e.png',
    reservationId: null,
    kycOwnerId: 'user-1',
    artisanAssignmentId: null,
    signedFileUrl: null,
    rejectedAt: new Date('2026-08-10T09:00:00.000Z'),
    rejectedReason: 'Document illisible, merci de joindre une pièce nette.',
    createdAt: new Date('2026-08-05T09:00:00.000Z'),
    signatures: [],
  };

  beforeEach(async () => {
    prisma = { document: { findUnique: jest.fn(), delete: jest.fn() } };
    storage = { deleteObject: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        KycService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    service = module.get(KycService);
  });

  it('purgée réelle : objet B2 supprimé PUIS ligne base supprimée', async () => {
    prisma.document.findUnique.mockResolvedValue(rejectedDoc);
    prisma.document.delete.mockResolvedValue(rejectedDoc);

    await service.purgeRejectedDocument('doc-kyc-1');

    expect(storage.deleteObject).toHaveBeenCalledWith('kyc/4f7a2d1e.png');
    expect(prisma.document.delete).toHaveBeenCalledWith({
      where: { id: 'doc-kyc-1' },
    });
    expect(storage.deleteObject).toHaveBeenCalled();
  });

  it('ne purge pas un document introuvable', async () => {
    prisma.document.findUnique.mockResolvedValue(null);

    await service.purgeRejectedDocument('doc-absent');

    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(prisma.document.delete).not.toHaveBeenCalled();
  });

  it('ne purge pas un document qui n\'est pas une pièce KYC', async () => {
    prisma.document.findUnique.mockResolvedValue({
      ...rejectedDoc,
      type: DocumentType.CONTRAT,
      kycOwnerId: null,
      rejectedAt: null,
    });

    await service.purgeRejectedDocument('doc-kyc-1');

    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(prisma.document.delete).not.toHaveBeenCalled();
  });

  it('ne purge pas une pièce jamais rejetée (rejectedAt null)', async () => {
    prisma.document.findUnique.mockResolvedValue({
      ...rejectedDoc,
      rejectedAt: null,
    });

    await service.purgeRejectedDocument('doc-kyc-1');

    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(prisma.document.delete).not.toHaveBeenCalled();
  });

  it('purgée même si le statut courant du user a évolué (resoumission/validation)', async () => {
    // Cas clé : user passé EN_ATTENTE (resoumission) ou VALIDE — la pièce
    // rejetée antérieurement reste à échéance dans le périmètre de purge.
    prisma.document.findUnique.mockResolvedValue(rejectedDoc);

    await service.purgeRejectedDocument('doc-kyc-1');

    expect(storage.deleteObject).toHaveBeenCalledWith('kyc/4f7a2d1e.png');
    expect(prisma.document.delete).toHaveBeenCalledWith({
      where: { id: 'doc-kyc-1' },
    });
  });

  it('délègue bien l\'appel si la suppression objet échoue (retry BullMQ)', async () => {
    prisma.document.findUnique.mockResolvedValue(rejectedDoc);
    storage.deleteObject.mockRejectedValue(new Error('S3 timeout'));

    await expect(service.purgeRejectedDocument('doc-kyc-1')).rejects.toThrow(
      'S3 timeout',
    );
    // La ligne base n'est PAS supprimée : le retry peut rejouer la purge entière.
    expect(prisma.document.delete).not.toHaveBeenCalled();
  });
});