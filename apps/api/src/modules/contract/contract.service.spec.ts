import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ContractSignerType, DocumentType, Prisma, UserRole, ReservationStatus } from '@prisma/client';
import { ContractService } from './contract.service';
import { ContractPdfService } from './contract-pdf.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { StorageService } from '../../common/storage/storage.service';

const VALID_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

const p2002 = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.22.0',
  });

const createMockPrisma = () => ({
  reservation: {
    findUnique: jest.fn(),
  },
  artisanAssignment: {
    findUnique: jest.fn(),
  },
  document: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  contractSignature: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
});

const createMockNotifications = () => ({
  notifyUser: jest.fn().mockResolvedValue(undefined),
});

const createMockPdf = () => ({
  generate: jest.fn().mockResolvedValue('contracts/generated.pdf'),
  sign: jest.fn().mockResolvedValue('contracts/signed.pdf'),
});

const createMockStorage = () => ({
  putObject: jest.fn().mockResolvedValue(undefined),
  getObject: jest.fn(),
  getSignedUrl: jest.fn(),
  deleteObject: jest.fn(),
});

describe('ContractService', () => {
  let service: ContractService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let notifications: ReturnType<typeof createMockNotifications>;
  let pdf: ReturnType<typeof createMockPdf>;
  let storage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    prisma = createMockPrisma();
    notifications = createMockNotifications();
    pdf = createMockPdf();
    storage = createMockStorage();
    service = new ContractService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationService,
      pdf as unknown as ContractPdfService,
      storage as unknown as StorageService,
    );
    prisma.document.create.mockResolvedValue({ id: 'document-1' });
    prisma.document.findFirst.mockResolvedValue(null);
  });

  describe('generateBuyerContract', () => {
    it('refuse une réservation inexistante', async () => {
      prisma.reservation.findUnique.mockResolvedValue(null);

      await expect(
        service.generateBuyerContract('reservation-1', 'user-1', UserRole.ACHETEUR),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuse un acheteur qui ne possède pas la réservation', async () => {
      prisma.reservation.findUnique.mockResolvedValue({ userId: 'owner-1' });

      await expect(
        service.generateBuyerContract('reservation-1', 'intruder-1', UserRole.ACHETEUR),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.document.create).not.toHaveBeenCalled();
    });

    it('crée le contrat lié à la réservation et notifie son propriétaire', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        userId: 'user-1',
        user: { fullName: 'Kofi Mensah', email: 'kofi@test.tg', phone: '+22890000000' },
        unit: {
          type: 'T2',
          surface: 55,
          price: { toString: () => '35000000' },
          currency: 'XOF',
          block: { name: 'Bloc A', project: { name: 'Projet Test' } },
        },
      });

      await service.generateBuyerContract('reservation-1', 'user-1', UserRole.ACHETEUR);

      expect(pdf.generate).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Contrat de réservation et de vente',
        reference: 'reservation-1',
      }));

      expect(prisma.document.create).toHaveBeenCalledWith({
        data: {
          type: DocumentType.CONTRAT,
          name: 'Contrat de vente - reservation-1',
          fileUrl: 'contracts/generated.pdf',
          reservationId: 'reservation-1',
        },
      });
      expect(notifications.notifyUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ title: 'Votre contrat est disponible' }),
      );
    });

    it('retourne le contrat existant en silence si déjà généré (idempotence)', async () => {
      prisma.reservation.findUnique.mockResolvedValue({ userId: 'user-1' });
      const existing = { id: 'document-existant', type: DocumentType.CONTRAT };
      prisma.document.findFirst.mockResolvedValue(existing);

      const result = await service.generateBuyerContract('reservation-1', 'user-1', UserRole.ACHETEUR);

      expect(result).toBe(existing);
      expect(prisma.document.create).not.toHaveBeenCalled();
      expect(pdf.generate).not.toHaveBeenCalled();
    });

    it('retourne l\'existant même s\'il est déjà signé (ne casse jamais une signature)', async () => {
      prisma.reservation.findUnique.mockResolvedValue({ userId: 'user-1' });
      const existing = {
        id: 'document-signe',
        type: DocumentType.CONTRAT,
        signatures: [{ signerType: ContractSignerType.PROPRIETAIRE }],
      };
      prisma.document.findFirst.mockResolvedValue(existing);

      const result = await service.generateBuyerContract('reservation-1', 'user-1', UserRole.ACHETEUR);

      expect(result).toBe(existing);
      expect(prisma.document.create).not.toHaveBeenCalled();
      expect(pdf.generate).not.toHaveBeenCalled();
    });
  });

  describe('regenerateBuyerContract', () => {
    it('refuse un non-administrateur', async () => {
      prisma.reservation.findUnique.mockResolvedValue({ userId: 'user-1' });

      await expect(
        service.regenerateBuyerContract('reservation-1', 'user-1', UserRole.ACHETEUR),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.document.delete).not.toHaveBeenCalled();
    });

    it('refuse une réservation inexistante', async () => {
      prisma.reservation.findUnique.mockResolvedValue(null);

      await expect(
        service.regenerateBuyerContract('reservation-1', 'admin-1', UserRole.ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('palier 1 : bloque si le propriétaire a déjà signé (aucune exception)', async () => {
      prisma.reservation.findUnique.mockResolvedValue({ userId: 'user-1' });
      prisma.document.findFirst.mockResolvedValue({
        id: 'document-signe',
        fileUrl: 'contracts/old.pdf',
        signatures: [{ signerType: ContractSignerType.PROPRIETAIRE }],
      });

      await expect(
        service.regenerateBuyerContract('reservation-1', 'admin-1', UserRole.ADMIN, true),
      ).rejects.toThrow(ConflictException);
      expect(prisma.document.delete).not.toHaveBeenCalled();
      expect(storage.deleteObject).not.toHaveBeenCalled();
    });

    it('palier 2 : exige la confirmation (force) quand seul l\'admin a signé', async () => {
      prisma.reservation.findUnique.mockResolvedValue({ userId: 'user-1' });
      prisma.document.findFirst.mockResolvedValue({
        id: 'document-admin-signé',
        fileUrl: 'contracts/old.pdf',
        signatures: [{ signerType: ContractSignerType.ADMIN }],
      });

      await expect(
        service.regenerateBuyerContract('reservation-1', 'admin-1', UserRole.ADMIN),
      ).rejects.toThrow(ConflictException);
      expect(prisma.document.delete).not.toHaveBeenCalled();
    });

    it('palier 2 confirmé : régénère quand force=true', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        userId: 'user-1',
        user: { fullName: 'Kofi Mensah', email: 'kofi@test.tg', phone: '+22890000000' },
        unit: {
          type: 'T2',
          surface: 55,
          price: { toString: () => '35000000' },
          currency: 'XOF',
          block: { name: 'Bloc A', project: { name: 'Projet Test' } },
        },
      });
      prisma.document.findFirst.mockResolvedValueOnce({
        id: 'document-admin-signé',
        fileUrl: 'contracts/old.pdf',
        signatures: [{ signerType: ContractSignerType.ADMIN }],
      });
      prisma.document.create.mockResolvedValue({ id: 'document-neuf' });

      const result = await service.regenerateBuyerContract('reservation-1', 'admin-1', UserRole.ADMIN, true);

      expect(prisma.document.delete).toHaveBeenCalledWith({ where: { id: 'document-admin-signé' } });
      expect(storage.deleteObject).toHaveBeenCalledWith('contracts/old.pdf');
      expect(prisma.document.create).toHaveBeenCalled();
      expect(result.id).toBe('document-neuf');
    });

    it('palier 3 : régénère librement si rien n\'est signé (rotation)', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        userId: 'user-1',
        user: { fullName: 'Kofi Mensah', email: 'kofi@test.tg', phone: '+22890000000' },
        unit: {
          type: 'T2',
          surface: 55,
          price: { toString: () => '35000000' },
          currency: 'XOF',
          block: { name: 'Bloc A', project: { name: 'Projet Test' } },
        },
      });
      prisma.document.findFirst.mockResolvedValueOnce({
        id: 'document-non-signe',
        fileUrl: 'contracts/old.pdf',
        signatures: [],
      });
      prisma.document.create.mockResolvedValue({ id: 'document-neuf' });

      const result = await service.regenerateBuyerContract('reservation-1', 'admin-1', UserRole.ADMIN);

      expect(prisma.document.delete).toHaveBeenCalledWith({ where: { id: 'document-non-signe' } });
      expect(storage.deleteObject).toHaveBeenCalledWith('contracts/old.pdf');
      expect(prisma.document.create).toHaveBeenCalled();
      expect(result.id).toBe('document-neuf');
    });

    it('se comporte comme une génération initiale quand aucun contrat n\'existe', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        userId: 'user-1',
        user: { fullName: 'Kofi Mensah', email: 'kofi@test.tg', phone: '+22890000000' },
        unit: {
          type: 'T2',
          surface: 55,
          price: { toString: () => '35000000' },
          currency: 'XOF',
          block: { name: 'Bloc A', project: { name: 'Projet Test' } },
        },
      });
      prisma.document.findFirst.mockResolvedValue(null);
      prisma.document.create.mockResolvedValue({ id: 'document-neuf' });

      const result = await service.regenerateBuyerContract('reservation-1', 'admin-1', UserRole.ADMIN);

      expect(prisma.document.delete).not.toHaveBeenCalled();
      expect(prisma.document.create).toHaveBeenCalled();
      expect(result.id).toBe('document-neuf');
    });
  });

  describe('generateArtisanContract', () => {
    it('crée le contrat avec artisanAssignmentId dédié', async () => {
      prisma.artisanAssignment.findUnique.mockResolvedValue({
        id: 'assignment-1',
        artisan: { userId: 'artisan-user-1' },
        block: { name: 'Bloc A', project: { name: 'Projet Test' } },
      });

      await service.generateArtisanContract(
        'assignment-1',
        'artisan-user-1',
        UserRole.ARTISAN,
      );

      expect(prisma.document.create).toHaveBeenCalledWith({
        data: {
          type: DocumentType.CONTRAT,
          name: 'Contrat artisan - affectation assignment-1',
          fileUrl: 'contracts/generated.pdf',
          artisanAssignmentId: 'assignment-1',
        },
      });
      expect(notifications.notifyUser).toHaveBeenCalledWith(
        'artisan-user-1',
        expect.objectContaining({ title: "Contrat d'intervention disponible" }),
      );
    });

    it('refuse un artisan qui ne possède pas l’affectation', async () => {
      prisma.artisanAssignment.findUnique.mockResolvedValue({
        id: 'assignment-1',
        artisan: { userId: 'owner-1' },
      });

      await expect(
        service.generateArtisanContract(
          'assignment-1',
          'intruder-1',
          UserRole.ARTISAN,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.document.create).not.toHaveBeenCalled();
    });
  });

  it('liste uniquement les contrats de la réservation autorisée', async () => {
    prisma.reservation.findUnique.mockResolvedValue({ userId: 'user-1' });
    prisma.document.findMany.mockResolvedValue([]);

    await service.listBuyerContracts('reservation-1', 'user-1', UserRole.ACHETEUR);

    expect(prisma.document.findMany).toHaveBeenCalledWith({
      where: { reservationId: 'reservation-1', type: DocumentType.CONTRAT },
      orderBy: { createdAt: 'desc' },
    });
  });

  describe('signContract', () => {
    const buyerDocument = {
      id: 'document-1',
      fileUrl: 'contracts/1.pdf',
      reservation: { userId: 'user-1' },
      artisanAssignment: null,
      signatures: [] as { signerType: ContractSignerType; signatureImageUrl: string }[],
    };

    beforeEach(() => {
      prisma.contractSignature.create.mockResolvedValue({ id: 'signature-1' });
      prisma.contractSignature.findMany.mockResolvedValue([]);
      prisma.document.update.mockResolvedValue({ id: 'document-1', signedFileUrl: 'contracts/signed.pdf' });
      prisma.document.findUnique.mockResolvedValue(buyerDocument);
    });

    it('refuse une image qui n\'est pas un vrai PNG (magic byte)', async () => {
      await expect(
        service.signContract('document-1', 'user-1', UserRole.ACHETEUR, Buffer.from('not-a-png')),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.contractSignature.create).not.toHaveBeenCalled();
    });

    it('refuse un document inconnu', async () => {
      prisma.document.findUnique.mockResolvedValue(null);

      await expect(
        service.signContract('document-1', 'user-1', UserRole.ACHETEUR, VALID_PNG),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuse un document sans propriétaire signataire résolvable', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'document-1',
        fileUrl: 'contracts/1.pdf',
        reservation: null,
        artisanAssignment: null,
        signatures: [],
      });

      await expect(
        service.signContract('document-1', 'user-1', UserRole.ACHETEUR, VALID_PNG),
      ).rejects.toThrow(ForbiddenException);
    });

    it("refuse de signer un contrat lie a une reservation annulee (obsolete)", async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'document-1',
        fileUrl: 'contracts/1.pdf',
        reservation: { userId: 'user-1', status: ReservationStatus.ANNULEE },
        artisanAssignment: null,
        signatures: [],
      });

      await expect(
        service.signContract('document-1', 'user-1', UserRole.ACHETEUR, VALID_PNG),
      ).rejects.toThrow(ConflictException);
      expect(prisma.contractSignature.create).not.toHaveBeenCalled();
      expect(storage.putObject).not.toHaveBeenCalled();
    });

    it('signe en PROPRIETAIRE pour l\'acheteur propriétaire (jamais ADMIN côté client)', async () => {
      prisma.contractSignature.findMany.mockResolvedValue([
        { signerType: ContractSignerType.PROPRIETAIRE, signatureImageUrl: 'signatures/a.png' },
      ]);
      prisma.document.findUnique.mockResolvedValue(buyerDocument);

      await service.signContract('document-1', 'user-1', UserRole.ACHETEUR, VALID_PNG);

      // La signature PNG est déposée sur B2 sous une clé interne avant d'être
      // référencée en base
      expect(storage.putObject).toHaveBeenCalledTimes(1);
      const [uploadKey, uploadBody, contentType] = storage.putObject.mock.calls[0];
      expect(uploadKey).toMatch(/^signatures\/[0-9a-f-]+\.png$/);
      expect(uploadBody).toBe(VALID_PNG);
      expect(contentType).toBe('image/png');

      expect(prisma.contractSignature.create).toHaveBeenCalledWith({
        data: {
          documentId: 'document-1',
          signerType: ContractSignerType.PROPRIETAIRE,
          signerUserId: 'user-1',
          signatureImageUrl: uploadKey,
        },
      });
    });

    it('signe en PROPRIETAIRE pour l\'artisan affecté', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'document-1',
        fileUrl: 'contracts/1.pdf',
        reservation: null,
        artisanAssignment: { artisan: { userId: 'artisan-user-1' } },
        signatures: [],
      });

      await service.signContract('document-1', 'artisan-user-1', UserRole.ARTISAN, VALID_PNG);

      expect(prisma.contractSignature.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          signerType: ContractSignerType.PROPRIETAIRE,
          signerUserId: 'artisan-user-1',
        }),
      });
    });

    it('persiste l\'adresse IP et le user-agent du signataire', async () => {
      await service.signContract('document-1', 'user-1', UserRole.ACHETEUR, VALID_PNG, '192.0.2.10', 'Mozilla/5.0 (trace-test)');
      const [uploadKey] = storage.putObject.mock.calls[0];
      expect(prisma.contractSignature.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentId: 'document-1',
            signerType: ContractSignerType.PROPRIETAIRE,
            signerUserId: 'user-1',
            signatureImageUrl: uploadKey,
            ipAddress: '192.0.2.10',
            userAgent: 'Mozilla/5.0 (trace-test)',
          }),
        }),
      );
    });

    it('signe sans IP ni user-agent si non fournis (optionnels)', async () => {
      await service.signContract('document-1', 'user-1', UserRole.ACHETEUR, VALID_PNG);
      const [uploadKey] = storage.putObject.mock.calls[0];
      expect(prisma.contractSignature.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentId: 'document-1',
            signerType: ContractSignerType.PROPRIETAIRE,
            signerUserId: 'user-1',
            signatureImageUrl: uploadKey,
            ipAddress: undefined,
            userAgent: undefined,
          }),
        }),
      );
    });

    it('refuse un tiers (ni propriétaire ni admin)', async () => {
      await expect(
        service.signContract('document-1', 'intruder-1', UserRole.ACHETEUR, VALID_PNG),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.contractSignature.create).not.toHaveBeenCalled();
    });

    it('refuse la signature ADMIN tant que le propriétaire n\'a pas signé', async () => {
      prisma.document.findUnique.mockResolvedValue({ ...buyerDocument, signatures: [] });

      await expect(
        service.signContract('document-1', 'admin-1', UserRole.ADMIN, VALID_PNG),
      ).rejects.toThrow(ConflictException);
      expect(prisma.contractSignature.create).not.toHaveBeenCalled();
    });

    it('refuse le doublon de signature PROPRIETAIRE (409)', async () => {
      prisma.contractSignature.create.mockRejectedValue(p2002());

      await expect(
        service.signContract('document-1', 'user-1', UserRole.ACHETEUR, VALID_PNG),
      ).rejects.toThrow(ConflictException);
    });

    it('refuse le doublon de signature ADMIN (409)', async () => {
      prisma.document.findUnique.mockResolvedValue({
        ...buyerDocument,
        signatures: [{ signerType: ContractSignerType.PROPRIETAIRE, signatureImageUrl: 'signatures/a.png' }],
      });
      prisma.contractSignature.create.mockRejectedValue(p2002());

      await expect(
        service.signContract('document-1', 'admin-1', UserRole.ADMIN, VALID_PNG),
      ).rejects.toThrow(ConflictException);
    });

    it('contresigne le PDF et notifie une fois les deux signatures présentes', async () => {
      prisma.document.findUnique
        .mockResolvedValueOnce({
          ...buyerDocument,
          signatures: [{ signerType: ContractSignerType.PROPRIETAIRE, signatureImageUrl: 'signatures/a.png' }],
        })
        .mockResolvedValue({ id: 'document-1', signatures: [] });
      prisma.contractSignature.findMany.mockResolvedValue([
        { signerType: ContractSignerType.PROPRIETAIRE, signatureImageUrl: 'signatures/a.png' },
        { signerType: ContractSignerType.ADMIN, signatureImageUrl: 'signatures/b.png' },
      ]);

      await service.signContract('document-1', 'admin-1', UserRole.ADMIN, VALID_PNG);

      expect(pdf.sign).toHaveBeenCalledWith('contracts/1.pdf', [
        { label: 'Propriétaire', imageUrl: 'signatures/a.png' },
        { label: 'Administration', imageUrl: 'signatures/b.png' },
      ]);
      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: 'document-1' },
        data: { signedFileUrl: 'contracts/signed.pdf' },
      });
      expect(notifications.notifyUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ title: 'Contrat signé' }),
      );
    });
  });
});
