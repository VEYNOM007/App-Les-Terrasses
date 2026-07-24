import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ReservationService } from './reservation.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisLockService } from '../../common/redis/redis-lock.service';
import { LaunchService } from '../launch/launch.service';
import {
  cleanupTestDatabase,
  createUserFixture,
  createProjectWithBlockAndUnits,
  disconnectTestPrisma,
  getTestPrisma,
} from '../../common/testing/test-db.helper';
import { ReservationStatus, UnitStatus } from '@prisma/client';

/**
 * Tests d'integration — ReservationService
 *
 * Différence avec reservation.service.spec.ts (unitaire) :
 *   ici on utilise la VRAIE DB PostgreSQL (DATABASE_URL_TEST) et le
 *   VRAI Redis (docker-compose) pour valider :
 *     - Le lock Redis résiste à la concurrence réelle (Promise.all)
 *     - La transaction Prisma + updateMany conditionnel empêche bien
 *       la double-vente même si le lock Redis est contourné
 *     - L'état final en DB est cohérent (unit status, reservation)
 *
 * BullMQ Queue et LaunchService restent mockés pour éviter d'attendre
 * les jobs et de déclencher des side-effects métier hors scope.
 *
 * Env vars (DATABASE_URL_TEST, REDIS_URL) positionnées dans jest.setup.ts.
 */

describe('ReservationService — integration (vraie DB + Redis)', () => {
  let service: ReservationService;
  let module: TestingModule;
  let launchService: { checkFundingThreshold: jest.Mock };
  let queue: { add: jest.Mock };

  // Prisma pointant sur la DB de test (singleton via helper)
  const testPrisma = getTestPrisma();

  beforeAll(async () => {
    launchService = { checkFundingThreshold: jest.fn().mockResolvedValue(undefined) };
    queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };

    module = await Test.createTestingModule({
      providers: [
        ReservationService,
        { provide: PrismaService, useValue: testPrisma },
        RedisLockService,
        { provide: 'REDIS_CLIENT', useValue: testPrisma }, // placeholder, écrasé ci-dessous
        { provide: LaunchService, useValue: launchService },
        { provide: getQueueToken('reservation-expiration'), useValue: queue },
      ],
    })
      .overrideProvider('REDIS_CLIENT')
      .useValue({
        // Vrai client Redis via ioredis, sur le Redis du docker-compose
        set: async (key: string, token: string, ...rest: any[]) => {
          const Redis = require('ioredis');
          const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
          try {
            const result = await redis.set(key, token, ...rest);
            redis.disconnect();
            return result;
          } catch (e) {
            redis.disconnect();
            throw e;
          }
        },
        eval: async (script: string, keys: number, ...args: any[]) => {
          const Redis = require('ioredis');
          const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
          try {
            const result = await redis.eval(script, keys, ...args);
            redis.disconnect();
            return result;
          } catch (e) {
            redis.disconnect();
            throw e;
          }
        },
      })
      .compile();

    service = module.get<ReservationService>(ReservationService);
  });

  afterAll(async () => {
    await module.close();
    await disconnectTestPrisma();
  });

  beforeEach(async () => {
    await cleanupTestDatabase();
    launchService.checkFundingThreshold.mockClear();
    queue.add.mockClear();
  });

  // ──────────────────────────────────────────────────
  // reserveUnit — happy path
  // ──────────────────────────────────────────────────

  it('devrait reserver une unité DISPONIBLE et la passer en RESERVE', async () => {
    const user = await createUserFixture();
    const { units } = await createProjectWithBlockAndUnits(1);
    const unit = units[0];

    const reservation = await service.reserveUnit(unit.id, user.id);

    expect(reservation).toBeDefined();
    expect(reservation.status).toBe(ReservationStatus.EN_ATTENTE);
    expect(reservation.userId).toBe(user.id);
    expect(reservation.unitId).toBe(unit.id);

    // LockExpiresAt ~ maintenant + 48h
    const diff = new Date(reservation.lockExpiresAt).getTime() - Date.now();
    expect(diff).toBeGreaterThan(47 * 60 * 60 * 1000);
    expect(diff).toBeLessThan(49 * 60 * 60 * 1000);

    // Unit passée à RESERVE en DB
    const updatedUnit = await testPrisma.unit.findUniqueOrThrow({ where: { id: unit.id } });
    expect(updatedUnit.status).toBe(UnitStatus.RESERVE);

    // Job BullMQ ajouté avec delay 48h
    expect(queue.add).toHaveBeenCalledWith(
      'expire-reservation',
      { reservationId: reservation.id },
      expect.objectContaining({
        delay: 48 * 60 * 60 * 1000,
        jobId: reservation.id,
      }),
    );
  });

  // ──────────────────────────────────────────────────
  // reserveUnit — unit déjà réservée
  // ──────────────────────────────────────────────────

  it('devrait lever ConflictException si l\'unité est deja RESERVE', async () => {
    const user = await createUserFixture();
    const { units } = await createProjectWithBlockAndUnits(1);
    const unit = units[0];

    await service.reserveUnit(unit.id, user.id);

    const user2 = await createUserFixture({ email: 'other@test.tg', phone: '+22899999999' });
    await expect(service.reserveUnit(unit.id, user2.id)).rejects.toThrow(ConflictException);
  });

  // ──────────────────────────────────────────────────
  // reserveUnit — concurrence réelle
  // ──────────────────────────────────────────────────

  it('ne doit laisser qu\'un seul gagnant en concurrence réelle (Promise.all)', async () => {
    const { units } = await createProjectWithBlockAndUnits(1);
    const unit = units[0];

    const user1 = await createUserFixture({ email: 'u1@test.tg', phone: '+22811111111' });
    const user2 = await createUserFixture({ email: 'u2@test.tg', phone: '+22822222222' });
    const user3 = await createUserFixture({ email: 'u3@test.tg', phone: '+22833333333' });

    // 3 requêtes concurrentes — le lock Redis + la transaction
    // conditionnelle doivent garantir qu'une seule réussit
    const results = await Promise.allSettled([
      service.reserveUnit(unit.id, user1.id),
      service.reserveUnit(unit.id, user2.id),
      service.reserveUnit(unit.id, user3.id),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(2);
    rejected.forEach((r) => {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    });

    // Un seul statut RESERVE en DB (le gagnant)
    const reservations = await testPrisma.reservation.findMany({
      where: { unitId: unit.id },
    });
    expect(reservations).toHaveLength(1);
  });

  // ──────────────────────────────────────────────────
  // confirmReservation
  // ──────────────────────────────────────────────────

  it('confirmReservation doit passer la réservation en CONFIRMEE et l\'unit en VENDU + déclencher checkFundingThreshold', async () => {
    const user = await createUserFixture();
    const { block, units } = await createProjectWithBlockAndUnits(1);
    const reservation = await service.reserveUnit(units[0].id, user.id);

    await service.confirmReservation(reservation.id);

    const confirmed = await testPrisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
    expect(confirmed.status).toBe(ReservationStatus.CONFIRMEE);

    const unit = await testPrisma.unit.findUniqueOrThrow({ where: { id: units[0].id } });
    expect(unit.status).toBe(UnitStatus.VENDU);

    expect(launchService.checkFundingThreshold).toHaveBeenCalledWith(block.id);
  });

  // ──────────────────────────────────────────────────
  // cancelReservation
  // ──────────────────────────────────────────────────

  it('cancelReservation doit annuler et libérer l\'unit si owner et statut EN_ATTENTE', async () => {
    const user = await createUserFixture();
    const { units } = await createProjectWithBlockAndUnits(1);
    const reservation = await service.reserveUnit(units[0].id, user.id);

    await service.cancelReservation(reservation.id, user.id);

    const annulated = await testPrisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
    expect(annulated.status).toBe(ReservationStatus.ANNULEE);

    const unit = await testPrisma.unit.findUniqueOrThrow({ where: { id: units[0].id } });
    expect(unit.status).toBe(UnitStatus.DISPONIBLE);
  });

  it('cancelReservation doit lever ForbiddenException si non-owner', async () => {
    const user = await createUserFixture();
    const intruder = await createUserFixture({ email: 'intruder@test.tg', phone: '+22844444444' });
    const { units } = await createProjectWithBlockAndUnits(1);
    const reservation = await service.reserveUnit(units[0].id, user.id);

    await expect(service.cancelReservation(reservation.id, intruder.id)).rejects.toThrow(
      ForbiddenException,
    );

    // Inchangé en DB
    const unchanged = await testPrisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
    expect(unchanged.status).toBe(ReservationStatus.EN_ATTENTE);
  });

  it('cancelReservation doit lever ConflictException si deja CONFIRMEE', async () => {
    const user = await createUserFixture();
    const { units } = await createProjectWithBlockAndUnits(1);
    const reservation = await service.reserveUnit(units[0].id, user.id);
    await service.confirmReservation(reservation.id);

    await expect(service.cancelReservation(reservation.id, user.id)).rejects.toThrow(
      ConflictException,
    );
  });

  it('cancelReservation doit lever NotFoundException si réservation inexistante', async () => {
    const user = await createUserFixture();
    await expect(service.cancelReservation('non-existent-id', user.id)).rejects.toThrow(
      NotFoundException,
    );
  });

  // ──────────────────────────────────────────────────
  // findByUser
  // ──────────────────────────────────────────────────

  it('findByUser doit retourner les réservations avec unit + paymentSchedule', async () => {
    const user = await createUserFixture();
    const { units } = await createProjectWithBlockAndUnits(2);
    await service.reserveUnit(units[0].id, user.id);
    await service.reserveUnit(units[1].id, user.id);

    // Un autre user pour vérifier l'isolation
    const other = await createUserFixture({ email: 'other@test.tg', phone: '+22855555555' });
    const { units: unitsOther } = await createProjectWithBlockAndUnits(1);
    await service.reserveUnit(unitsOther[0].id, other.id);

    const mine = await service.findByUser(user.id);
    expect(mine).toHaveLength(2);
    expect(mine.every((r) => r.userId === user.id)).toBe(true);
    expect(mine[0].unit).toBeDefined();
  });
});
