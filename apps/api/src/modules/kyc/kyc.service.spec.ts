import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { DocumentType, KycStatus } from '@prisma/client';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { KycService } from './kyc.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { NotificationService } from '../notification/notification.service';
import { KYC_REJECTED_RETENTION_MS } from './kyc-retention.constants';

describe('KycService', () => {
  let service: KycService;
  let prisma: {
    document: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      delete: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    user: { update: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let storage: { deleteObject: jest.Mock; getSignedUrl: jest.Mock };
  let notifications: { notifyUser: jest.Mock };
  let retentionQueue: { add: jest.Mock };

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

  const pendingDoc = {
    ...rejectedDoc,
    id: 'doc-kyc-2',
    rejectedAt: null,
    rejectedReason: null,
    createdAt: new Date('2026-08-20T09:00:00.000Z'),
  };

  const runGuardChecks = (action: (id: string) => Promise<unknown>) => {
    it('lève NotFoundException pour un document inexistant', async () => {
      prisma.document.findUnique.mockResolvedValue(null);
      await expect(action('doc-inconnu')).rejects.toThrow(NotFoundException);
      expect(storage.deleteObject).not.toHaveBeenCalled();
    });

    it('lève NotFoundException pour un document qui n\'est pas une pièce KYC', async () => {
      prisma.document.findUnique.mockResolvedValue({
        ...pendingDoc,
        type: DocumentType.CONTRAT,
        kycOwnerId: null,
      });
      await expect(action('doc-kyc-2')).rejects.toThrow(NotFoundException);
      expect(storage.deleteObject).not.toHaveBeenCalled();
    });

    it('lève ConflictException quand la pièce n\'est plus la plus récente (resoumission)', async () => {
      prisma.document.findUnique.mockResolvedValue(pendingDoc);
      prisma.document.findFirst.mockResolvedValue({ ...pendingDoc, id: 'doc-kyc-3' });
      await expect(action('doc-kyc-2')).rejects.toThrow(ConflictException);
      expect(storage.deleteObject).not.toHaveBeenCalled();
    });
  };

  beforeEach(async () => {
    prisma = {
      document: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      user: { update: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    storage = { deleteObject: jest.fn(), getSignedUrl: jest.fn() };
    notifications = { notifyUser: jest.fn() };
    retentionQueue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };

    const module = await Test.createTestingModule({
      providers: [
        KycService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
        { provide: NotificationService, useValue: notifications },
        { provide: getQueueToken('kyc-document-retention'), useValue: retentionQueue },
      ],
    }).compile();

    service = module.get(KycService);
  });

  describe('purgeRejectedDocument', () => {
    it('purge réelle : objet B2 supprimé PUIS ligne base supprimée', async () => {
      prisma.document.findUnique.mockResolvedValue(rejectedDoc);
      prisma.document.findMany.mockResolvedValue([rejectedDoc]);
      prisma.document.delete.mockResolvedValue(rejectedDoc);

      await service.purgeRejectedDocument('doc-kyc-1');

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'doc-kyc-1', kycOwnerId: 'user-1', type: DocumentType.PIECE_IDENTITE },
        }),
      );
      expect(storage.deleteObject).toHaveBeenCalledWith('kyc/4f7a2d1e.png');
      expect(prisma.document.delete).toHaveBeenCalledWith({
        where: { id: 'doc-kyc-1' },
      });
    });

    it('purge toutes les faces du même lot (recto + verso)', async () => {
      const versoFace = { ...rejectedDoc, id: 'doc-kyc-1-v', side: 'VERSO', fileUrl: 'kyc/verso.png' };
      prisma.document.findUnique.mockResolvedValue({ ...rejectedDoc, kycBatchId: 'batch-1' });
      prisma.document.findMany.mockResolvedValue([rejectedDoc, versoFace]);
      prisma.document.delete.mockResolvedValue(rejectedDoc);

      await service.purgeRejectedDocument('doc-kyc-1');

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { kycBatchId: 'batch-1', kycOwnerId: 'user-1', type: DocumentType.PIECE_IDENTITE },
        }),
      );
      expect(storage.deleteObject).toHaveBeenCalledTimes(2);
      expect(storage.deleteObject).toHaveBeenCalledWith('kyc/4f7a2d1e.png');
      expect(storage.deleteObject).toHaveBeenCalledWith('kyc/verso.png');
      expect(prisma.document.delete).toHaveBeenCalledTimes(2);
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
      prisma.document.findUnique.mockResolvedValue({ ...rejectedDoc, rejectedAt: null });
      await service.purgeRejectedDocument('doc-kyc-1');
      expect(storage.deleteObject).not.toHaveBeenCalled();
      expect(prisma.document.delete).not.toHaveBeenCalled();
    });

    it('purgée même si le statut courant du user a évolué (resoumission/validation)', async () => {
      prisma.document.findUnique.mockResolvedValue(rejectedDoc);
      prisma.document.findMany.mockResolvedValue([rejectedDoc]);
      await service.purgeRejectedDocument('doc-kyc-1');
      expect(storage.deleteObject).toHaveBeenCalledWith('kyc/4f7a2d1e.png');
      expect(prisma.document.delete).toHaveBeenCalledWith({
        where: { id: 'doc-kyc-1' },
      });
    });

    it('délègue l\'erreur si la suppression objet échoue (retry BullMQ)', async () => {
      prisma.document.findUnique.mockResolvedValue(rejectedDoc);
      prisma.document.findMany.mockResolvedValue([rejectedDoc]);
      storage.deleteObject.mockRejectedValue(new Error('S3 timeout'));
      await expect(service.purgeRejectedDocument('doc-kyc-1')).rejects.toThrow('S3 timeout');
      expect(prisma.document.delete).not.toHaveBeenCalled();
    });
  });

  describe('listAdminKyc', () => {
    it('retourne les users non NON_SOUMIS avec la pièce la plus récente en tête', async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          fullName: 'Moussa Keita',
          email: 'moussa@test.tg',
          kycStatus: KycStatus.EN_ATTENTE,
          updatedAt: new Date('2026-08-28T10:00:00Z'),
          kycDocuments: [
            { ...pendingDoc, side: null, kycBatchId: null },
            { ...rejectedDoc, side: null, kycBatchId: null },
          ],
        },
      ]);

      const result = await service.listAdminKyc();

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { kycStatus: { not: KycStatus.NON_SOUMIS } },
        }),
      );
      expect(result).toEqual([
        {
          id: 'user-1',
          fullName: 'Moussa Keita',
          email: 'moussa@test.tg',
          kycStatus: KycStatus.EN_ATTENTE,
          updatedAt: new Date('2026-08-28T10:00:00Z'),
          latestDocument: {
            id: 'doc-kyc-2',
            name: pendingDoc.name,
            createdAt: pendingDoc.createdAt,
            rejectedAt: null,
            rejectedReason: null,
          },
          versoDocument: null,
          documentCount: 2,
        },
      ]);
      // Le tableau complet de pièces n'est pas exposé — seulement la plus récente.
      expect(result[0]).not.toHaveProperty('kycDocuments');
    });

    it('expose le verso du même lot que la pièce la plus récente', async () => {
      const verso = {
        ...pendingDoc,
        id: 'doc-kyc-2-v',
        side: 'VERSO',
        kycBatchId: 'batch-1',
      };
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          fullName: 'Moussa Keita',
          email: 'moussa@test.tg',
          kycStatus: KycStatus.EN_ATTENTE,
          updatedAt: new Date('2026-08-28T10:00:00Z'),
          kycDocuments: [
            { ...pendingDoc, side: 'RECTO', kycBatchId: 'batch-1' },
            verso,
          ],
        },
      ]);

      const result = await service.listAdminKyc();

      expect(result[0].latestDocument).toEqual({
        id: 'doc-kyc-2',
        name: pendingDoc.name,
        createdAt: pendingDoc.createdAt,
        rejectedAt: null,
        rejectedReason: null,
      });
      expect(result[0].versoDocument).toEqual({
        id: 'doc-kyc-2-v',
        name: verso.name,
        createdAt: verso.createdAt,
        rejectedAt: null,
        rejectedReason: null,
      });
      expect(result[0].documentCount).toBe(2);
    });
  });

  describe('getDocumentSignedUrl', () => {
    it('renvoie une URL signée depuis la clé B2 interne', async () => {
      prisma.document.findUnique.mockResolvedValue(pendingDoc);
      storage.getSignedUrl.mockResolvedValue('https://signed/kyc/4f7a2d1e.png?x=1');

      const result = await service.getDocumentSignedUrl('doc-kyc-2');

      expect(storage.getSignedUrl).toHaveBeenCalledWith('kyc/4f7a2d1e.png');
      expect(result).toEqual({ url: 'https://signed/kyc/4f7a2d1e.png?x=1' });
    });
  });

  describe('approve', () => {
    it('passe le user en VALIDE et notifie l\'acheteur', async () => {
      prisma.document.findUnique.mockResolvedValue(pendingDoc);
      prisma.document.findFirst.mockResolvedValue(pendingDoc);
      prisma.user.update.mockResolvedValue({ id: 'user-1', kycStatus: KycStatus.VALIDE });

      const result = await service.approve('doc-kyc-2');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { kycStatus: KycStatus.VALIDE },
      });
      expect(notifications.notifyUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ title: 'Vérification d\'identité validée' }),
      );
      expect(result).toEqual({ documentId: 'doc-kyc-2', kycStatus: KycStatus.VALIDE });
    });

    it('rejette la validation d\'un document déjà rejeté', async () => {
      prisma.document.findUnique.mockResolvedValue(rejectedDoc);
      await expect(service.approve('doc-kyc-1')).rejects.toThrow(ConflictException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    runGuardChecks((id) => service.approve(id));
  });

  describe('reject', () => {
    it('exige un motif non vide (obligatoire)', async () => {
      await expect(service.reject('doc-kyc-2', '   ')).rejects.toThrow(BadRequestException);
      await expect(service.reject('doc-kyc-2', '')).rejects.toThrow(BadRequestException);
      expect(prisma.document.updateMany).not.toHaveBeenCalled();
      expect(retentionQueue.add).not.toHaveBeenCalled();
    });

    it('rejette : motifts → REJETE, purge planifiée 15 j (jobId = documentId), notification avec motif', async () => {
      prisma.document.findUnique.mockResolvedValue(pendingDoc);
      prisma.document.findFirst.mockResolvedValue(pendingDoc);
      prisma.document.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.update.mockResolvedValue({ id: 'user-1', kycStatus: KycStatus.REJETE });

      const result = await service.reject('doc-kyc-2', '  Document flou, illisible.  ');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.document.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['doc-kyc-2'] } },
        data: expect.objectContaining({ rejectedReason: 'Document flou, illisible.' }),
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { kycStatus: KycStatus.REJETE },
      });
      expect(retentionQueue.add).toHaveBeenCalledWith(
        'retain-document',
        { documentId: 'doc-kyc-2' },
        { delay: KYC_REJECTED_RETENTION_MS, jobId: 'doc-kyc-2' },
      );
      expect(notifications.notifyUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          title: 'Vérification d\'identité rejetée',
          body: expect.stringContaining('Document flou, illisible.'),
        }),
      );
      expect(result).toEqual({ documentId: 'doc-kyc-2', kycStatus: KycStatus.REJETE });
    });

    it('rejette le lot complet (recto + verso) en une seule transaction', async () => {
      const verso = { ...pendingDoc, id: 'doc-kyc-2-v', side: 'VERSO', kycBatchId: 'batch-1' };
      prisma.document.findUnique.mockResolvedValue({ ...pendingDoc, side: 'RECTO', kycBatchId: 'batch-1' });
      prisma.document.findFirst.mockResolvedValue({ ...pendingDoc, side: 'RECTO', kycBatchId: 'batch-1' });
      prisma.document.findMany.mockResolvedValue([
        { ...pendingDoc, side: 'RECTO', kycBatchId: 'batch-1' },
        verso,
      ]);
      prisma.document.updateMany.mockResolvedValue({ count: 2 });
      prisma.user.update.mockResolvedValue({ id: 'user-1', kycStatus: KycStatus.REJETE });

      const result = await service.reject('doc-kyc-2', 'Flou.');

      expect(prisma.document.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['doc-kyc-2', 'doc-kyc-2-v'] } },
        data: expect.objectContaining({ rejectedReason: 'Flou.' }),
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { kycStatus: KycStatus.REJETE },
      });
      expect(result).toEqual({ documentId: 'doc-kyc-2', kycStatus: KycStatus.REJETE });
    });

    it('refuse le double rejet (rejectedAt déjà posé)', async () => {
      prisma.document.findUnique.mockResolvedValue(rejectedDoc);
      await expect(service.reject('doc-kyc-1', 'Encore flou.')).rejects.toThrow(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(retentionQueue.add).not.toHaveBeenCalled();
    });

    runGuardChecks((id) => service.reject(id, 'Motif valide'));
  });
});