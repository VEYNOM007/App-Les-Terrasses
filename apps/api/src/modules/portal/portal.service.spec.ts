import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PortalService } from './portal.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';

/**
 * Tests unitaires — PortalService.getDocumentFile (sécurité d'appartenance, R6)
 *
 * Un document téléchargeable doit appartenir au user via sa réservation
 * OU via son profil KYC — jamais à un tiers (403), jamais révélé s'il
 * n'existe pas (404). Le téléchargement passe par une URL signée B2
 * (jamais de proxy serveur) ; un contrat signé sert sa version contresignée.
 */

const createMockPrisma = () => ({
  document: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
});

const createMockStorage = () => ({
  putObject: jest.fn(),
  getObject: jest.fn(),
  getSignedUrl: jest.fn().mockResolvedValue('https://b2.signed-url.example/file'),
  deleteObject: jest.fn(),
});

describe('PortalService', () => {
  let service: PortalService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let storage: ReturnType<typeof createMockStorage>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    storage = createMockStorage();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortalService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    service = module.get<PortalService>(PortalService);
  });

  describe('getDocumentFile', () => {
    it('devrait autoriser le propriétaire d\'une réservation liée au document', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-001',
        fileUrl: 'kyc/file.pdf',
        reservation: { userId: 'user-001' },
        kycOwner: null,
      });

      const result = await service.getDocumentFile('doc-001', 'user-001');

      expect(storage.getSignedUrl).toHaveBeenCalledWith('kyc/file.pdf');
      expect(result).toEqual({ downloadUrl: 'https://b2.signed-url.example/file' });
    });

    it('devrait autoriser le propriétaire d\'un document KYC (sans réservation)', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-002',
        fileUrl: 'kyc/autre.pdf',
        reservation: null,
        kycOwner: { id: 'user-002' },
      });

      const result = await service.getDocumentFile('doc-002', 'user-002');

      expect(storage.getSignedUrl).toHaveBeenCalledWith('kyc/autre.pdf');
      expect(result).toEqual({ downloadUrl: 'https://b2.signed-url.example/file' });
    });

    it('devrait servir la version contresignée (signedFileUrl) quand elle existe', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-003',
        fileUrl: 'contracts/original.pdf',
        signedFileUrl: 'contracts/signed.pdf',
        reservation: { userId: 'user-001' },
        kycOwner: null,
      });

      const result = await service.getDocumentFile('doc-003', 'user-001');

      expect(storage.getSignedUrl).toHaveBeenCalledWith('contracts/signed.pdf');
      expect(result).toBeDefined();
    });

    it('devrait rejeter (403) un document appartenant à un autre utilisateur', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-001',
        fileUrl: 'kyc/file.pdf',
        reservation: { userId: 'user-001' },
        kycOwner: null,
      });

      await expect(service.getDocumentFile('doc-001', 'user-intrus')).rejects.toThrow(
        ForbiddenException,
      );
      expect(storage.getSignedUrl).not.toHaveBeenCalled();
    });

    it('devrait renvoyer 404 si le document n\'existe pas (sans fuiter son existence)', async () => {
      prisma.document.findUnique.mockResolvedValue(null);

      await expect(service.getDocumentFile('doc-inexistant', 'user-001')).rejects.toThrow(
        NotFoundException,
      );
      expect(storage.getSignedUrl).not.toHaveBeenCalled();
    });

    it('devrait renvoyer 404 si aucune clé de fichier n\'est enregistrée', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-004',
        fileUrl: null,
        signedFileUrl: null,
        reservation: { userId: 'user-001' },
        kycOwner: null,
      });

      await expect(service.getDocumentFile('doc-004', 'user-001')).rejects.toThrow(
        NotFoundException,
      );
      expect(storage.getSignedUrl).not.toHaveBeenCalled();
    });
  });

  describe('listDocuments', () => {
    it('devrait lister les contrats d\'une réservation ET d\'une affectation artisan', async () => {
      prisma.document.findMany.mockResolvedValue([]);

      await service.listDocuments('user-001');

      expect(prisma.document.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { reservation: { userId: 'user-001' } },
            { artisanAssignment: { artisan: { userId: 'user-001' } } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
