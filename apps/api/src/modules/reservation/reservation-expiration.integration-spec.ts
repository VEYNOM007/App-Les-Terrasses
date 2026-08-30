import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { KycStatus, ReservationStatus, UnitStatus } from '@prisma/client';
import { ReservationExpirationProcessor } from './reservation-expiration.processor';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationModule } from '../notification/notification.module';
import { NotificationService } from '../notification/notification.service';
import {
  cleanupTestDatabase,
  createUserFixture,
  createProjectWithBlockAndUnits,
  disconnectTestPrisma,
  getTestPrisma,
} from '../../common/testing/test-db.helper';

/**
 * Tests INTEGRATION du mecanisme d'expiration de reservation a 48h — queue
 * BullMQ REELLE (Redis) + Worker REEL (ReservationExpirationProcessor) +
 * base de test.
 *
 * Ce mecanisme est critique (il libere une unite reservee "a la seconde
 * pres"). Le worker est agnostique au delai (source de verite = le timer
 * BullMQ pose a la creation) : on exerce donc le cycle complet avec un
 * delai court, comme pour le worker de retention KYC.
 *
 * Couverture des regles metier (volet 2) :
 *  R1. Aucune piece soumise (kycStatus = NON_SOUMIS) -> le decompte de 48h
 *      s'applique normalement : le job ANNULE la reservation et libere
 *      l'unite. (Comportement historique preserve.)
 *  R2. Piece en cours d'examen admin (kycStatus = EN_ATTENTE) -> le job se
 *      REPORTE (passe en delayed) : ni la reservation ni l'unite ne sont
 *      touchees pendant l'examen.
 *  R3. Admin a rejete (kycStatus = REJETE) -> le job reprend et ANNULE.
 *  R4. Admin a valide mais acompte non paye (kycStatus = VALIDE) -> le job
 *      reprend et ANNULE (aucun logement bloque indefiniment).
 *  R5. Reservation deja confirmee (status != EN_ATTENTE) -> job ignore, rien
 *      ne change (idempotence existante).
 */

const EXPIRATION_QUEUE = 'reservation-expiration';
const EXPIRATION_QUEUE_TOKEN = getQueueToken(EXPIRATION_QUEUE);
const SHORT_EXPIRATION_DELAY_MS = 300;
const WAIT_TIMEOUT_MS = 15_000;

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs = WAIT_TIMEOUT_MS,
  stepMs = 100,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
  throw new Error(`waitFor: condition non atteinte apres ${timeoutMs} ms`);
}

describe('Expiration reservation - integration queue reelle (BullMQ + Redis)', () => {
  let app: INestApplication;
  let queue: Queue;

  const testPrisma = getTestPrisma();
  const notifyUser = jest.fn().mockResolvedValue({ id: 'notif-exp' });

  /**
   * Cree un acheteur (avec le kycStatus voulu), une unite RESERVE et une
   * reservation EN_ATTENTE (48h) liee — l'etat exact qu'un job d'expiration
   * est cense traiter.
   */
  async function seedExpirableReservation(kycStatus: KycStatus) {
    const user = await createUserFixture({});
    await testPrisma.user.update({
      where: { id: user.id },
      data: { kycStatus },
    });

    const { units } = await createProjectWithBlockAndUnits(1);
    const unit = units[0];
    await testPrisma.unit.update({
      where: { id: unit.id },
      data: { status: UnitStatus.RESERVE },
    });

    const reservation = await testPrisma.reservation.create({
      data: {
        unitId: unit.id,
        userId: user.id,
        status: ReservationStatus.EN_ATTENTE,
        lockExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });

    return { userId: user.id, unitId: unit.id, reservationId: reservation.id };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        BullModule.forRoot({
          connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
        }),
        BullModule.registerQueue({ name: EXPIRATION_QUEUE }),
        PrismaModule,
        NotificationModule,
      ],
      providers: [ReservationExpirationProcessor],
    })
      .overrideProvider(PrismaService)
      .useValue(testPrisma)
      .overrideProvider(NotificationService)
      .useValue({ notifyUser })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    queue = app.get<Queue>(EXPIRATION_QUEUE_TOKEN);

    // Repart d'une file vierge (un run tue laisse idealement un job delayed).
    await queue.obliterate({ force: true });
  });

  afterEach(async () => {
    await queue.obliterate({ force: true });
    notifyUser.mockClear();
    await cleanupTestDatabase();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (queue) {
      await queue.close();
    }
    await disconnectTestPrisma();
  });

  it('R1 - aucune piece KYC (NON_SOUMIS) : le job ANNULE la reservation et libere l\'unite', async () => {
    const { userId, unitId, reservationId } = await seedExpirableReservation(KycStatus.NON_SOUMIS);

    await queue.add('expire-reservation', { reservationId }, { delay: SHORT_EXPIRATION_DELAY_MS, jobId: reservationId });

    // Le Worker reel annule ~300 ms plus tard : reservation ANNULEE, unite DISPONIBLE.
    await waitFor(async () => {
      const res = await testPrisma.reservation.findUnique({ where: { id: reservationId } });
      return res?.status === ReservationStatus.ANNULEE;
    });

    const reservation = await testPrisma.reservation.findUnique({ where: { id: reservationId } });
    const unit = await testPrisma.unit.findUnique({ where: { id: unitId } });
    expect(reservation?.status).toBe(ReservationStatus.ANNULEE);
    expect(unit?.status).toBe(UnitStatus.DISPONIBLE);
    expect(notifyUser).toHaveBeenCalledWith(userId, expect.any(Object));
    await waitFor(async () => (await queue.getJobState(reservationId)) === 'completed');
  });

  it('R2 - piece en cours d\'examen (EN_ATTENTE) : le job se REPORTE, reservation ET unite intouchees', async () => {
    const { unitId, reservationId } = await seedExpirableReservation(KycStatus.EN_ATTENTE);

    await queue.add('expire-reservation', { reservationId }, { delay: SHORT_EXPIRATION_DELAY_MS, jobId: reservationId });

    // Le worker est passe et a reporte le job en `delayed` (moveToDelayed).
    await waitFor(async () => {
      const state = await queue.getJobState(reservationId);
      return state === 'delayed';
    });

    const reservation = await testPrisma.reservation.findUnique({ where: { id: reservationId } });
    const unit = await testPrisma.unit.findUnique({ where: { id: unitId } });
    expect(reservation?.status).toBe(ReservationStatus.EN_ATTENTE);
    expect(unit?.status).toBe(UnitStatus.RESERVE);
    expect(notifyUser).not.toHaveBeenCalled();
    expect(await queue.getJobState(reservationId)).toBe('delayed');

    // Nettoie le job reporte pour ne pas polluer les tests suivants.
    await queue.remove(reservationId);
  });

  it('R3 - piece rejetee (REJETE) : le job reprend et ANNULE la reservation', async () => {
    const { unitId, reservationId } = await seedExpirableReservation(KycStatus.REJETE);

    await queue.add('expire-reservation', { reservationId }, { delay: SHORT_EXPIRATION_DELAY_MS, jobId: reservationId });

    await waitFor(async () => {
      const res = await testPrisma.reservation.findUnique({ where: { id: reservationId } });
      return res?.status === ReservationStatus.ANNULEE;
    });

    const unit = await testPrisma.unit.findUnique({ where: { id: unitId } });
    expect(unit?.status).toBe(UnitStatus.DISPONIBLE);
  });

  it('R4 - piece validee mais acompte non paye (VALIDE) : le job reprend et ANNULE', async () => {
    const { unitId, reservationId } = await seedExpirableReservation(KycStatus.VALIDE);

    await queue.add('expire-reservation', { reservationId }, { delay: SHORT_EXPIRATION_DELAY_MS, jobId: reservationId });

    await waitFor(async () => {
      const res = await testPrisma.reservation.findUnique({ where: { id: reservationId } });
      return res?.status === ReservationStatus.ANNULEE;
    });

    const unit = await testPrisma.unit.findUnique({ where: { id: unitId } });
    expect(unit?.status).toBe(UnitStatus.DISPONIBLE);
  });

  it('R5 - reservation deja confirmee : le job IGNORE, rien ne change', async () => {
    const user = await createUserFixture({});
    const { units } = await createProjectWithBlockAndUnits(1);
    const unit = units[0];
    await testPrisma.unit.update({ where: { id: unit.id }, data: { status: UnitStatus.VENDU } });

    const reservation = await testPrisma.reservation.create({
      data: {
        unitId: unit.id,
        userId: user.id,
        status: ReservationStatus.CONFIRMEE,
        lockExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });

    await queue.add('expire-reservation', { reservationId: reservation.id }, { delay: SHORT_EXPIRATION_DELAY_MS, jobId: reservation.id });

    await waitFor(async () => (await queue.getJobState(reservation.id)) === 'completed');

    const resAfter = await testPrisma.reservation.findUnique({ where: { id: reservation.id } });
    const unitAfter = await testPrisma.unit.findUnique({ where: { id: unit.id } });
    expect(resAfter?.status).toBe(ReservationStatus.CONFIRMEE);
    expect(unitAfter?.status).toBe(UnitStatus.VENDU);
    expect(notifyUser).not.toHaveBeenCalled();
  });
});

