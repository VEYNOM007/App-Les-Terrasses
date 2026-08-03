import { BadRequestException } from '@nestjs/common';
import { LaunchStatus, UnitStatus } from '@prisma/client';
import { LaunchService } from './launch.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

const createMockPrisma = () => ({
  block: {
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
  reservation: {
    findMany: jest.fn(),
  },
});

const createMockNotifications = () => ({
  notifyUser: jest.fn(),
});

describe('LaunchService', () => {
  let service: LaunchService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let notifications: ReturnType<typeof createMockNotifications>;

  beforeEach(() => {
    prisma = createMockPrisma();
    notifications = createMockNotifications();
    service = new LaunchService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationService,
    );
  });

  describe('checkFundingThreshold', () => {
    it('ne bascule pas le lot sous le seuil', async () => {
      const block = {
        id: 'block-1',
        launchStatus: LaunchStatus.EN_COMMERCIALISATION,
        fundingThresholdPercent: 75,
        units: [
          { status: UnitStatus.VENDU },
          { status: UnitStatus.DISPONIBLE },
          { status: UnitStatus.DISPONIBLE },
          { status: UnitStatus.DISPONIBLE },
        ],
      };
      prisma.block.findUniqueOrThrow.mockResolvedValue(block);

      const result = await service.checkFundingThreshold('block-1');

      expect(result).toBe(block);
      expect(prisma.block.update).not.toHaveBeenCalled();
      expect(notifications.notifyUser).not.toHaveBeenCalled();
    });

    it('bascule le lot à SEUIL_ATTEINT et notifie les admins au seuil', async () => {
      const block = {
        id: 'block-1',
        launchStatus: LaunchStatus.EN_COMMERCIALISATION,
        fundingThresholdPercent: 50,
        units: [{ status: UnitStatus.VENDU }, { status: UnitStatus.LIVRE }],
      };
      const updated = { ...block, launchStatus: LaunchStatus.SEUIL_ATTEINT };
      prisma.block.findUniqueOrThrow.mockResolvedValue(block);
      prisma.block.update.mockResolvedValue(updated);
      prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }]);
      notifications.notifyUser.mockResolvedValue(undefined);

      const result = await service.checkFundingThreshold('block-1');

      expect(result).toBe(updated);
      expect(prisma.block.update).toHaveBeenCalledWith({
        where: { id: 'block-1' },
        data: {
          launchStatus: LaunchStatus.SEUIL_ATTEINT,
          thresholdReachedAt: expect.any(Date),
        },
      });
      expect(notifications.notifyUser).toHaveBeenCalledTimes(2);
      expect(notifications.notifyUser).toHaveBeenCalledWith(
        'admin-1',
        expect.objectContaining({ title: 'Seuil de financement atteint', body: expect.stringContaining('100%') }),
      );
    });

    it('ne recalcule pas un lot déjà sorti de la commercialisation', async () => {
      const block = {
        id: 'block-1',
        launchStatus: LaunchStatus.EN_CONSTRUCTION,
        fundingThresholdPercent: 50,
        units: [{ status: UnitStatus.VENDU }],
      };
      prisma.block.findUniqueOrThrow.mockResolvedValue(block);

      const result = await service.checkFundingThreshold('block-1');

      expect(result).toBe(block);
      expect(prisma.block.update).not.toHaveBeenCalled();
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  describe('transitions de financement', () => {
    it('refuse le dépôt du dossier si le seuil n’est pas atteint', async () => {
      prisma.block.findUniqueOrThrow.mockResolvedValue({
        launchStatus: LaunchStatus.EN_COMMERCIALISATION,
      });

      await expect(service.markFinancingSubmitted('block-1')).rejects.toThrow(BadRequestException);
      expect(prisma.block.update).not.toHaveBeenCalled();
    });

    it('autorise la transition SEUIL_ATTEINT vers FINANCEMENT_EN_COURS', async () => {
      prisma.block.findUniqueOrThrow.mockResolvedValue({
        launchStatus: LaunchStatus.SEUIL_ATTEINT,
      });
      prisma.block.update.mockResolvedValue({ launchStatus: LaunchStatus.FINANCEMENT_EN_COURS });

      await service.markFinancingSubmitted('block-1');

      expect(prisma.block.update).toHaveBeenCalledWith({
        where: { id: 'block-1' },
        data: { launchStatus: LaunchStatus.FINANCEMENT_EN_COURS },
      });
    });

    it('refuse de sécuriser le financement avant le dépôt bancaire', async () => {
      prisma.block.findUniqueOrThrow.mockResolvedValue({
        launchStatus: LaunchStatus.SEUIL_ATTEINT,
      });

      await expect(service.markFinancingSecured('block-1')).rejects.toThrow(BadRequestException);
      expect(prisma.block.update).not.toHaveBeenCalled();
    });
  });

  describe('setFundingThreshold et getLaunchStatus', () => {
    it('refuse un seuil hors de l’intervalle 1..100', async () => {
      await expect(service.setFundingThreshold('block-1', 0)).rejects.toThrow(BadRequestException);
      await expect(service.setFundingThreshold('block-1', 101)).rejects.toThrow(BadRequestException);
      expect(prisma.block.update).not.toHaveBeenCalled();
    });

    it('retourne un taux de remplissage nul pour un lot sans unité', async () => {
      prisma.block.findUniqueOrThrow.mockResolvedValue({
        launchStatus: LaunchStatus.EN_COMMERCIALISATION,
        fundingThresholdPercent: 50,
        units: [],
        thresholdReachedAt: null,
        financingSecuredAt: null,
      });

      const result = await service.getLaunchStatus('block-1');

      expect(result.currentFillRatePercent).toBe(0);
      expect(result.soldUnits).toBe(0);
      expect(result.totalUnits).toBe(0);
    });

    it('retourne un taux de dossier nul pour un lot sans unité', async () => {
      prisma.block.findUniqueOrThrow.mockResolvedValue({
        project: { name: 'Résidence Test' },
        name: 'Bloc A',
        units: [],
      });

      const result = await service.generateFundingDossier('block-1');

      expect(result.fillRatePercent).toBe(0);
      expect(result.soldUnits).toBe(0);
      expect(result.totalPreVenduAmount).toBe(0);
      expect(result.buyers).toEqual([]);
    });
  });
});
