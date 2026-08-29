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
  reservation: {
    findMany: jest.fn(),
  },
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

  describe('getDashboard', () => {
    it('devrait exposer createdAt et updatedAt (dates de l\'historique des annulées)', async () => {
      prisma.reservation.findMany.mockResolvedValue([
        {
          id: 'resa-001',
          status: 'ANNULEE',
          createdAt: new Date('2026-07-01T08:00:00.000Z'),
          updatedAt: new Date('2026-07-05T10:00:00.000Z'),
          unit: {
            block: {
              progressPercent: 20,
              constructionPhase: 'STRUCTURE',
            },
          },
          paymentSchedule: {
            installments: [],
          },
        },
      ]);

      const result = await service.getDashboard('user-001');

      expect(result).toEqual([
        {
          reservationId: 'resa-001',
          status: 'ANNULEE',
          createdAt: new Date('2026-07-01T08:00:00.000Z'),
          updatedAt: new Date('2026-07-05T10:00:00.000Z'),
          unit: { block: { progressPercent: 20, constructionPhase: 'STRUCTURE' } },
          constructionProgress: 20,
          constructionPhase: 'STRUCTURE',
          nextInstallment: undefined,
        },
      ]);
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
        include: {
          reservation: { select: { id: true, status: true } },
          signatures: { select: { signerType: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('devrait exposer reservationId/reservationStatus/buyerSigned/adminSigned et retirer le noeud reservation imbriqué', async () => {
      prisma.document.findMany.mockResolvedValue([
        {
          id: 'doc-010',
          type: 'CONTRAT',
          name: 'Contrat Studio',
          fileUrl: 'contracts/original.pdf',
          signedFileUrl: null,
          createdAt: new Date('2026-07-01T08:00:00.000Z'),
          signatures: [{ signerType: 'PROPRIETAIRE' }],
          reservation: { id: 'resa-001', status: 'ANNULEE' },
        },
        {
          id: 'doc-012',
          type: 'CONTRAT',
          name: 'Contrat T2',
          fileUrl: 'contracts/original.pdf',
          signedFileUrl: null,
          createdAt: new Date('2026-07-02T08:00:00.000Z'),
          signatures: [{ signerType: 'PROPRIETAIRE' }, { signerType: 'ADMIN' }],
          reservation: { id: 'resa-002', status: 'CONFIRMEE' },
        },
        {
          id: 'doc-011',
          type: 'DEVIS',
          name: 'Devis artisan',
          fileUrl: 'artisan/devis.pdf',
          signedFileUrl: null,
          createdAt: new Date('2026-07-03T08:00:00.000Z'),
          signatures: [],
          reservation: null,
        },
      ]);

      const result = await service.listDocuments('user-001');

      expect(result).toHaveLength(3);
      // Palier 1 : acheteur signé, promoteur en attente
      expect(result[0]).toMatchObject({
        id: 'doc-010',
        reservationId: 'resa-001',
        reservationStatus: 'ANNULEE',
        buyerSigned: true,
        adminSigned: false,
      });
      expect(result[0]).not.toHaveProperty('reservation');
      expect(result[0]).not.toHaveProperty('signatures');
      // Contrat entièrement signé
      expect(result[1]).toMatchObject({
        id: 'doc-012',
        buyerSigned: true,
        adminSigned: true,
      });
      // Document sans réservation ni signature (pièce artisan)
      expect(result[2]).toMatchObject({
        id: 'doc-011',
        reservationId: null,
        reservationStatus: null,
        buyerSigned: false,
        adminSigned: false,
      });
      expect(result[2]).not.toHaveProperty('reservation');
    });
  });
});
