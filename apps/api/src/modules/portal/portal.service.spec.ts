import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PortalService } from './portal.service';
import { PrismaService } from '../../common/prisma/prisma.service';

jest.mock('../../common/files/uploads.util', () => ({
  resolveUploadFilePath: jest.fn(),
}));

import { resolveUploadFilePath } from '../../common/files/uploads.util';
const mockResolveUploadFilePath = resolveUploadFilePath as jest.MockedFunction<
  typeof resolveUploadFilePath
>;

/**
 * Tests unitaires — PortalService.getDocumentFile (sécurité d'appartenance, R6)
 *
 * Un document téléchargeable doit appartenir au user via sa réservation
 * OU via son profil KYC — jamais à un tiers (403), jamais révélé s'il
 * n'existe pas (404).
 */

const createMockPrisma = () => ({
  document: {
    findUnique: jest.fn(),
  },
});

describe('PortalService', () => {
  let service: PortalService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    mockResolveUploadFilePath.mockReset();
    mockResolveUploadFilePath.mockReturnValue({
      absolutePath: '/tmp/uploads/kyc/file.pdf',
      mimeType: 'application/pdf',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortalService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PortalService>(PortalService);
  });

  describe('getDocumentFile', () => {
    it('devrait autoriser le propriétaire d\'une réservation liée au document', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-001',
        fileUrl: '/uploads/kyc/file.pdf',
        reservation: { userId: 'user-001' },
        kycOwner: null,
      });

      const result = await service.getDocumentFile('doc-001', 'user-001');

      expect(mockResolveUploadFilePath).toHaveBeenCalledWith('/uploads/kyc/file.pdf');
      expect(result).toEqual({
        absolutePath: '/tmp/uploads/kyc/file.pdf',
        mimeType: 'application/pdf',
      });
    });

    it('devrait autoriser le propriétaire d\'un document KYC (sans réservation)', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-002',
        fileUrl: '/uploads/kyc/autre.pdf',
        reservation: null,
        kycOwner: { id: 'user-002' },
      });

      const result = await service.getDocumentFile('doc-002', 'user-002');

      expect(mockResolveUploadFilePath).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('devrait rejeter (403) un document appartenant à un autre utilisateur', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-001',
        fileUrl: '/uploads/kyc/file.pdf',
        reservation: { userId: 'user-001' },
        kycOwner: null,
      });

      await expect(service.getDocumentFile('doc-001', 'user-intrus')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockResolveUploadFilePath).not.toHaveBeenCalled();
    });

    it('devrait renvoyer 404 si le document n\'existe pas (sans fuiter son existence)', async () => {
      prisma.document.findUnique.mockResolvedValue(null);

      await expect(service.getDocumentFile('doc-inexistant', 'user-001')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
