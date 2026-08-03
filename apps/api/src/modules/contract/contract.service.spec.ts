import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DocumentType, UserRole } from '@prisma/client';
import { ContractService } from './contract.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

const createMockPrisma = () => ({
  reservation: {
    findUnique: jest.fn(),
  },
  artisanAssignment: {
    findUnique: jest.fn(),
  },
  document: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
});

const createMockNotifications = () => ({
  notifyUser: jest.fn().mockResolvedValue(undefined),
});

describe('ContractService', () => {
  let service: ContractService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let notifications: ReturnType<typeof createMockNotifications>;

  beforeEach(() => {
    prisma = createMockPrisma();
    notifications = createMockNotifications();
    service = new ContractService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationService,
    );
    prisma.document.create.mockResolvedValue({ id: 'document-1' });
  });

  describe('generateBuyerContract', () => {
    it('refuse une réservation inexistante', async () => {
      prisma.reservation.findUnique.mockResolvedValue(null);

      await expect(
        service.generateBuyerContract('reservation-1', '/contracts/1.pdf', 'user-1', UserRole.ACHETEUR),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuse un acheteur qui ne possède pas la réservation', async () => {
      prisma.reservation.findUnique.mockResolvedValue({ userId: 'owner-1' });

      await expect(
        service.generateBuyerContract('reservation-1', '/contracts/1.pdf', 'intruder-1', UserRole.ACHETEUR),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.document.create).not.toHaveBeenCalled();
    });

    it('crée le contrat lié à la réservation et notifie son propriétaire', async () => {
      prisma.reservation.findUnique.mockResolvedValue({ userId: 'user-1' });

      await service.generateBuyerContract('reservation-1', '/contracts/1.pdf', 'user-1', UserRole.ACHETEUR);

      expect(prisma.document.create).toHaveBeenCalledWith({
        data: {
          type: DocumentType.CONTRAT,
          name: 'Contrat de vente - reservation-1',
          fileUrl: '/contracts/1.pdf',
          reservationId: 'reservation-1',
        },
      });
      expect(notifications.notifyUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ title: 'Votre contrat est disponible' }),
      );
    });
  });

  describe('generateArtisanContract', () => {
    it('crée le contrat avec artisanAssignmentId dédié', async () => {
      prisma.artisanAssignment.findUnique.mockResolvedValue({
        id: 'assignment-1',
        artisan: { userId: 'artisan-user-1' },
      });

      await service.generateArtisanContract(
        'assignment-1',
        '/contracts/artisan-1.pdf',
        'artisan-user-1',
        UserRole.ARTISAN,
      );

      expect(prisma.document.create).toHaveBeenCalledWith({
        data: {
          type: DocumentType.CONTRAT,
          name: 'Contrat artisan - affectation assignment-1',
          fileUrl: '/contracts/artisan-1.pdf',
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
          '/contracts/artisan-1.pdf',
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
});
