import { Test, TestingModule } from '@nestjs/testing';
import { ReservationService } from './reservation.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisLockService } from '../../common/redis/redis-lock.service';
import { LaunchService } from '../launch/launch.service';
import { ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';

/**
 * Tests unitaires — ReservationService
 *
 * Scénarios critiques couverts (Règle R6 CLAUDE.md) :
 *  1. reserveUnit — succès : lock Redis acquis, transaction Prisma, job BullMQ planifié
 *  2. reserveUnit — lock Redis non acquis → ConflictException
 *  3. reserveUnit — unité déjà réservée (updateMany.count = 0) → ConflictException
 *  4. reserveUnit — libération du lock Redis même en cas d'erreur (finally)
 *  5. confirmReservation — statut CONFIRMEE, unité VENDU, appel checkFundingThreshold
 *  6. cancelReservation — réservation EN_ATTENTE par le bon propriétaire → annulée
 *  7. cancelReservation — utilisateur non propriétaire → ForbiddenException
 *  8. cancelReservation — réservation déjà confirmée → ConflictException
 *  9. cancelReservation — réservation introuvable → NotFoundException
 * 10. findByUser — retourne les réservations de l'utilisateur
 */

// ────────────────────────────────────────────────────────────
// Mocks partagés
// ────────────────────────────────────────────────────────────

const createMockPrisma = () => ({
  $transaction: jest.fn(),
  unit: {
    findUniqueOrThrow: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  },
  reservation: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
});

const createMockRedisLock = () => ({
  lockKeyForUnit: jest.fn((unitId: string) => `lock:unit:${unitId}`),
  acquire: jest.fn(),
  release: jest.fn().mockResolvedValue(undefined),
});

const createMockLaunchService = () => ({
  checkFundingThreshold: jest.fn().mockResolvedValue(undefined),
});

const createMockExpirationQueue = () => ({
  add: jest.fn().mockResolvedValue(undefined),
});

// ────────────────────────────────────────────────────────────
// Suite de tests
// ────────────────────────────────────────────────────────────

describe('ReservationService', () => {
  let service: ReservationService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let redisLock: ReturnType<typeof createMockRedisLock>;
  let launchService: ReturnType<typeof createMockLaunchService>;
  let expirationQueue: ReturnType<typeof createMockExpirationQueue>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    redisLock = createMockRedisLock();
    launchService = createMockLaunchService();
    expirationQueue = createMockExpirationQueue();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisLockService, useValue: redisLock },
        { provide: LaunchService, useValue: launchService },
        { provide: getQueueToken('reservation-expiration'), useValue: expirationQueue },
      ],
    }).compile();

    service = module.get<ReservationService>(ReservationService);
  });

  // ──────────────────────────────────────────────────
  // reserveUnit — verrou anti-double-vente
  // ──────────────────────────────────────────────────

  describe('reserveUnit', () => {
    it('devrait créer une réservation avec lock Redis, transaction Prisma et job BullMQ', async () => {
      const mockReservation = { id: 'res-001', unitId: 'unit-001', userId: 'user-001' };

      // Lock Redis acquis
      redisLock.acquire.mockResolvedValue('token-abc');

      // Transaction Prisma : simule la callback
      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          unit: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          reservation: {
            create: jest.fn().mockResolvedValue(mockReservation),
          },
        };
        return callback(tx);
      });

      const result = await service.reserveUnit('unit-001', 'user-001');

      // Vérification : lock Redis acquis
      expect(redisLock.acquire).toHaveBeenCalledWith('lock:unit:unit-001', 10_000);

      // Vérification : job BullMQ planifié à 48h
      expect(expirationQueue.add).toHaveBeenCalledWith(
        'expire-reservation',
        { reservationId: 'res-001' },
        expect.objectContaining({
          delay: 48 * 60 * 60 * 1000,
          jobId: 'res-001',
        }),
      );

      // Vérification : lock Redis libéré
      expect(redisLock.release).toHaveBeenCalledWith('lock:unit:unit-001', 'token-abc');

      expect(result).toEqual(mockReservation);
    });

    it('devrait rejeter si le lock Redis ne peut être acquis (double réservation simultanée)', async () => {
      redisLock.acquire.mockResolvedValue(null);

      await expect(
        service.reserveUnit('unit-001', 'user-001'),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.reserveUnit('unit-001', 'user-001'),
      ).rejects.toThrow('en cours de réservation');

      // Aucune transaction ne doit être tentée
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('devrait rejeter si l\'unité n\'est plus disponible (updateMany.count = 0)', async () => {
      redisLock.acquire.mockResolvedValue('token-def');

      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          unit: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
          reservation: {
            create: jest.fn(),
          },
        };
        return callback(tx);
      });

      await expect(
        service.reserveUnit('unit-001', 'user-001'),
      ).rejects.toThrow(ConflictException);

      // Le lock Redis doit être libéré même en cas d'erreur
      expect(redisLock.release).toHaveBeenCalledWith('lock:unit:unit-001', 'token-def');
    });

    it('devrait libérer le lock Redis même si la transaction échoue (finally)', async () => {
      redisLock.acquire.mockResolvedValue('token-ghi');

      prisma.$transaction.mockRejectedValue(new Error('DB connection lost'));

      await expect(
        service.reserveUnit('unit-001', 'user-001'),
      ).rejects.toThrow('DB connection lost');

      // Le lock DOIT être libéré dans le finally
      expect(redisLock.release).toHaveBeenCalledWith('lock:unit:unit-001', 'token-ghi');
    });
  });

  // ──────────────────────────────────────────────────
  // confirmReservation — acompte payé
  // ──────────────────────────────────────────────────

  describe('confirmReservation', () => {
    it('devrait confirmer la réservation, marquer l\'unité VENDU et vérifier le seuil', async () => {
      const mockReservation = { id: 'res-001', unitId: 'unit-001', userId: 'user-001' };

      // Transaction Prisma : simule la callback
      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          reservation: {
            update: jest.fn().mockResolvedValue(mockReservation),
          },
          unit: {
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      // Pour le findUniqueOrThrow après la transaction
      prisma.unit.findUniqueOrThrow.mockResolvedValue({
        id: 'unit-001',
        blockId: 'block-A',
      });

      const result = await service.confirmReservation('res-001');

      // Vérification : transaction appelée
      expect(prisma.$transaction).toHaveBeenCalled();

      // Vérification : checkFundingThreshold appelé avec le blockId
      expect(launchService.checkFundingThreshold).toHaveBeenCalledWith('block-A');

      expect(result).toEqual(mockReservation);
    });
  });

  // ──────────────────────────────────────────────────
  // cancelReservation — annulation
  // ──────────────────────────────────────────────────

  describe('cancelReservation', () => {
    it('devrait annuler une réservation EN_ATTENTE par son propriétaire', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        id: 'res-001',
        unitId: 'unit-001',
        userId: 'user-001',
        status: 'EN_ATTENTE',
      });

      prisma.$transaction.mockResolvedValue(undefined);

      await service.cancelReservation('res-001', 'user-001');

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('devrait rejeter si la réservation est introuvable', async () => {
      prisma.reservation.findUnique.mockResolvedValue(null);

      await expect(
        service.cancelReservation('res-inexistant', 'user-001'),
      ).rejects.toThrow(NotFoundException);
    });

    it('devrait rejeter si l\'utilisateur n\'est pas le propriétaire', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        id: 'res-001',
        unitId: 'unit-001',
        userId: 'user-001',
        status: 'EN_ATTENTE',
      });

      await expect(
        service.cancelReservation('res-001', 'user-intrus'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('devrait rejeter si la réservation est déjà confirmée', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        id: 'res-001',
        unitId: 'unit-001',
        userId: 'user-001',
        status: 'CONFIRMEE',
      });

      await expect(
        service.cancelReservation('res-001', 'user-001'),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.cancelReservation('res-001', 'user-001'),
      ).rejects.toThrow('en attente');
    });
  });

  // ──────────────────────────────────────────────────
  // findByUser
  // ──────────────────────────────────────────────────

  describe('findByUser', () => {
    it('devrait retourner les réservations de l\'utilisateur avec unités et échéanciers', async () => {
      const mockData = [
        {
          id: 'res-001',
          unitId: 'unit-001',
          userId: 'user-001',
          unit: { id: 'unit-001', type: 'T3' },
          paymentSchedule: { installments: [] },
        },
      ];

      prisma.reservation.findMany.mockResolvedValue(mockData);

      const result = await service.findByUser('user-001');

      expect(prisma.reservation.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-001' },
        include: { unit: true, paymentSchedule: { include: { installments: true } } },
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toEqual(mockData);
    });
  });
});
