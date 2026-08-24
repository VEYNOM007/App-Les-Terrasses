import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { ReservationController } from './reservation.controller';
import { ReservationService } from './reservation.service';
import { LaunchService } from '../launch/launch.service';
import { PaymentService } from '../payment/payment.service';
import { AdminReservationController } from '../admin/admin-reservation.controller';
import { RedisModule } from '../../common/redis/redis.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  cleanupTestDatabase,
  createUserFixture,
  createProjectWithBlockAndUnits,
  disconnectTestPrisma,
  extractCookieValue,
  getTestPrisma,
} from '../../common/testing/test-db.helper';

/**
 * Tests e2e HTTP — ReservationModule (POST /v1/reservations, etc.)
 *
 * Différence avec l'integration-spec : ici on boot une vraie app Nest
 * ( TestingModule + AuthModule + ReservationModule + RedisModule), on
 * obtient un vrai JWT via POST /v1/auth/login, et on tape les routes
 * HTTP avec supertest. Valide le wiring Nest (guards, decorators)
 * au-delà de la logique service.
 *
 * Env vars (JWT_SECRET, DATABASE_URL, etc.) sont positionnées dans
 * jest.setup.ts exécuté avant tout import — AuthModule lit
 * process.env.JWT_SECRET à l'import.
 *
 * Overrides nécessaires :
 *   - PrismaService -> singleton sur DATABASE_URL_TEST
 *   - LaunchService -> mock (pour ne pas déclencher le recalcul du seuil)
 *   - queue 'reservation-expiration' -> mock (pas de jobs réels)
 */

const API_PREFIX = 'v1';

describe('ReservationModule — e2e HTTP (supertest)', () => {
  let app: INestApplication;
  const testPrisma = getTestPrisma();
  let queueAdd: jest.Mock;
  let generateSchedule: jest.Mock;

  beforeAll(async () => {
    queueAdd = jest.fn().mockResolvedValue({ id: 'job-e2e' });
    generateSchedule = jest.fn().mockResolvedValue({ id: 'schedule-e2e' });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        BullModule.forRoot({
          connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
        }),
        BullModule.registerQueue({ name: 'reservation-expiration' }),
        PrismaModule,
        RedisModule,
        AuthModule,
      ],
      controllers: [ReservationController, AdminReservationController],
      providers: [
        ReservationService,
        LaunchService,
        { provide: PaymentService, useValue: { generateSchedule } },
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(testPrisma)
      .overrideProvider(LaunchService)
      .useValue({ checkFundingThreshold: jest.fn().mockResolvedValue(undefined) })
      .overrideProvider(getQueueToken('reservation-expiration'))
      .useValue({ add: queueAdd })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    // Même pipe que main.ts : whitelist + rejet des champs inconnus + transform.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    await disconnectTestPrisma();
  });

  beforeEach(async () => {
    await cleanupTestDatabase();
    queueAdd.mockClear();
    generateSchedule.mockClear();
  });

  // ──────────────────────────────────────────────────
  // Helper : login et retourne le JWT (extrait du cookie httpOnly)
  // ──────────────────────────────────────────────────

  async function loginAndGetToken(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/login`)
      .send({ email, password });
    const token = extractCookieValue(res, 'access_token');
    if (!token) throw new Error('access_token absent du Set-Cookie après login');
    return token;
  }

  // ──────────────────────────────────────────────────
  // POST /v1/reservations
  // ──────────────────────────────────────────────────

  it('POST /reservations sans JWT -> 401 Unauthorized', async () => {
    const { units } = await createProjectWithBlockAndUnits(1);

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/reservations`)
      .send({ unitId: units[0].id });

    expect(res.status).toBe(401);
  });

  it('POST /reservations avec JWT valide -> 201, reservation + échéancier créés en DB', async () => {
    const user = await createUserFixture({ email: 'e2e@test.tg', phone: '+22810101010', password: 'Secret123!' });
    const { units } = await createProjectWithBlockAndUnits(1);
    const token = await loginAndGetToken('e2e@test.tg', 'Secret123!');

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/reservations`)
      .set('Authorization', `Bearer ${token}`)
      .send({ unitId: units[0].id });

    expect(res.status).toBe(201);
    expect(res.body.reservation).toHaveProperty('id');
    expect(res.body.reservation.status).toBe('EN_ATTENTE');
    expect(res.body.reservation.unitId).toBe(units[0].id);
    expect(res.body.reservation.userId).toBe(user.id);
    expect(res.body.schedule).toHaveProperty('id');
    expect(generateSchedule).toHaveBeenCalledWith(res.body.reservation.id);

    // Unit passée à RESERVE
    const unit = await testPrisma.unit.findUniqueOrThrow({ where: { id: units[0].id } });
    expect(unit.status).toBe('RESERVE');
  });

  it('POST /reservations sur unit déjà réservée -> 409 Conflict', async () => {
    await createUserFixture({ email: 'e2e1@test.tg', phone: '+22811111111', password: 'Secret123!' });
    await createUserFixture({ email: 'e2e2@test.tg', phone: '+22822222222', password: 'Secret123!' });
    const { units } = await createProjectWithBlockAndUnits(1);
    const token1 = await loginAndGetToken('e2e1@test.tg', 'Secret123!');
    const token2 = await loginAndGetToken('e2e2@test.tg', 'Secret123!');

    // Premier POST -> 201
    await request(app.getHttpServer())
      .post(`/${API_PREFIX}/reservations`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ unitId: units[0].id })
      .expect(201);

    // Second POST -> 409
    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/reservations`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ unitId: units[0].id });

    expect(res.status).toBe(409);
  });

  // ──────────────────────────────────────────────────
  // DELETE /v1/reservations/:id
  // ──────────────────────────────────────────────────

  it('DELETE /reservations/:id par owner -> 200, unit libérée', async () => {
    await createUserFixture({ email: 'owner@test.tg', phone: '+22844444444', password: 'Secret123!' });
    const { units } = await createProjectWithBlockAndUnits(1);
    const token = await loginAndGetToken('owner@test.tg', 'Secret123!');

    const createRes = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/reservations`)
      .set('Authorization', `Bearer ${token}`)
      .send({ unitId: units[0].id });
    expect(createRes.status).toBe(201);

    const reservationId = createRes.body.reservation.id;
    const deleteRes = await request(app.getHttpServer())
      .delete(`/${API_PREFIX}/reservations/${reservationId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);

    // Unit revenue à DISPONIBLE
    const unit = await testPrisma.unit.findUniqueOrThrow({ where: { id: units[0].id } });
    expect(unit.status).toBe('DISPONIBLE');
  });

  it('DELETE /reservations/:id par non-owner -> 403 Forbidden', async () => {
    await createUserFixture({ email: 'owner2@test.tg', phone: '+22855555555', password: 'Secret123!' });
    await createUserFixture({ email: 'intruder@test.tg', phone: '+22866666666', password: 'Secret123!' });
    const { units } = await createProjectWithBlockAndUnits(1);

    const tokenOwner = await loginAndGetToken('owner2@test.tg', 'Secret123!');
    const tokenIntruder = await loginAndGetToken('intruder@test.tg', 'Secret123!');

    const createRes = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/reservations`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ unitId: units[0].id });
    expect(createRes.status).toBe(201);

    const reservationId = createRes.body.reservation.id;
    const deleteRes = await request(app.getHttpServer())
      .delete(`/${API_PREFIX}/reservations/${reservationId}`)
      .set('Authorization', `Bearer ${tokenIntruder}`);
    expect(deleteRes.status).toBe(403);
  });

  // ──────────────────────────────────────────────────
  // GET /v1/reservations
  // ──────────────────────────────────────────────────

  it('GET /reservations retourne uniquement les réservations du user connecté', async () => {
    await createUserFixture({ email: 'mine@test.tg', phone: '+22877777777', password: 'Secret123!' });
    await createUserFixture({ email: 'other@test.tg', phone: '+22888888888', password: 'Secret123!' });

    const mineUnits = await createProjectWithBlockAndUnits(2);
    const otherUnits = await createProjectWithBlockAndUnits(1);

    const tokenMine = await loginAndGetToken('mine@test.tg', 'Secret123!');
    const tokenOther = await loginAndGetToken('other@test.tg', 'Secret123!');

    await request(app.getHttpServer())
      .post(`/${API_PREFIX}/reservations`)
      .set('Authorization', `Bearer ${tokenMine}`)
      .send({ unitId: mineUnits.units[0].id })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/${API_PREFIX}/reservations`)
      .set('Authorization', `Bearer ${tokenMine}`)
      .send({ unitId: mineUnits.units[1].id })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/${API_PREFIX}/reservations`)
      .set('Authorization', `Bearer ${tokenOther}`)
      .send({ unitId: otherUnits.units[0].id })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/${API_PREFIX}/reservations`)
      .set('Authorization', `Bearer ${tokenMine}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((r: any) => r.unit)).toBe(true);
  });

  // ──────────────────────────────────────────────────
  // POST /v1/admin/reservations — vente manuelle back-office (R6)
  // ──────────────────────────────────────────────────

  describe('POST /admin/reservations (vente commerciale admin, R6)', () => {
    it('sans JWT -> 401 Unauthorized', async () => {
      const { units } = await createProjectWithBlockAndUnits(1);

      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/admin/reservations`)
        .send({ unitId: units[0].id, userId: 'user-any' });

      expect(res.status).toBe(401);
    });

    it('par un ACHETEUR -> 403 Forbidden', async () => {
      await createUserFixture({ email: 'acheteur@test.tg', phone: '+22832000001', password: 'Secret123!' });
      const { units } = await createProjectWithBlockAndUnits(1);
      const token = await loginAndGetToken('acheteur@test.tg', 'Secret123!');

      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/admin/reservations`)
        .set('Authorization', `Bearer ${token}`)
        .send({ unitId: units[0].id, userId: 'user-any' });

      expect(res.status).toBe(403);
    });

    it('par un ADMIN avec offre <= prix catalogue -> 201, réservation + échéancier, unité RESERVE', async () => {
      const adminUser = await createUserFixture({ email: 'admin@test.tg', phone: '+22831000001', password: 'Secret123!', role: 'ADMIN' });
      const { units } = await createProjectWithBlockAndUnits(1);
      const token = await loginAndGetToken('admin@test.tg', 'Secret123!');

      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/admin/reservations`)
        .set('Authorization', `Bearer ${token}`)
        .send({ unitId: units[0].id, userId: adminUser.id, offerPrice: 20_000_000, offerLabel: 'Offre commerciale e2e' });

      expect(res.status).toBe(201);
      expect(res.body.reservation).toMatchObject({
        unitId: units[0].id,
        userId: adminUser.id,
        status: 'EN_ATTENTE',
        offerPrice: '20000000',
        offerLabel: 'Offre commerciale e2e',
      });
      // L'échéancier est généré sur le montant réellement engagé (offerPrice)
      expect(res.body.schedule).toEqual({ id: 'schedule-e2e' });
      expect(generateSchedule).toHaveBeenCalledWith(res.body.reservation.id);

      // L'unité est passée à RESERVE (même verrou que le parcours acheteur)
      const unit = await testPrisma.unit.findUniqueOrThrow({ where: { id: units[0].id } });
      expect(unit.status).toBe('RESERVE');
    });

    it('par un ADMIN avec offre > prix catalogue -> 400, aucun échéancier généré', async () => {
      await createUserFixture({ email: 'admin2@test.tg', phone: '+22831000002', password: 'Secret123!', role: 'ADMIN' });
      const { units } = await createProjectWithBlockAndUnits(1);
      const token = await loginAndGetToken('admin2@test.tg', 'Secret123!');

      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/admin/reservations`)
        .set('Authorization', `Bearer ${token}`)
        .send({ unitId: units[0].id, userId: 'user-any', offerPrice: 25_000_000 });

      expect(res.status).toBe(400);
      expect(generateSchedule).not.toHaveBeenCalled();
    });

    it('par un ADMIN avec offerPrice négatif -> 400 (validation DTO @Min(0))', async () => {
      await createUserFixture({ email: 'admin3@test.tg', phone: '+22831000003', password: 'Secret123!', role: 'ADMIN' });
      const { units } = await createProjectWithBlockAndUnits(1);
      const token = await loginAndGetToken('admin3@test.tg', 'Secret123!');

      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/admin/reservations`)
        .set('Authorization', `Bearer ${token}`)
        .send({ unitId: units[0].id, userId: 'user-any', offerPrice: -5 });

      expect(res.status).toBe(400);
      expect(generateSchedule).not.toHaveBeenCalled();
    });
  });
});
