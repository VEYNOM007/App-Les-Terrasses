import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { ReservationController } from './reservation.controller';
import { ReservationService } from './reservation.service';
import { LaunchService } from '../launch/launch.service';
import { RedisModule } from '../../common/redis/redis.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  cleanupTestDatabase,
  createUserFixture,
  createProjectWithBlockAndUnits,
  disconnectTestPrisma,
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

  beforeAll(async () => {
    queueAdd = jest.fn().mockResolvedValue({ id: 'job-e2e' });

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
      controllers: [ReservationController],
      providers: [ReservationService, LaunchService],
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
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    await disconnectTestPrisma();
  });

  beforeEach(async () => {
    await cleanupTestDatabase();
    queueAdd.mockClear();
  });

  // ──────────────────────────────────────────────────
  // Helper : login et retourne le JWT
  // ──────────────────────────────────────────────────

  async function loginAndGetToken(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/login`)
      .send({ email, password });
    return res.body.accessToken;
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

  it('POST /reservations avec JWT valide -> 201, reservation créée en DB', async () => {
    const user = await createUserFixture({ email: 'e2e@test.tg', phone: '+22810101010', password: 'Secret123!' });
    const { units } = await createProjectWithBlockAndUnits(1);
    const token = await loginAndGetToken('e2e@test.tg', 'Secret123!');

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/reservations`)
      .set('Authorization', `Bearer ${token}`)
      .send({ unitId: units[0].id });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.status).toBe('EN_ATTENTE');
    expect(res.body.unitId).toBe(units[0].id);
    expect(res.body.userId).toBe(user.id);

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

    const deleteRes = await request(app.getHttpServer())
      .delete(`/${API_PREFIX}/reservations/${createRes.body.id}`)
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

    const deleteRes = await request(app.getHttpServer())
      .delete(`/${API_PREFIX}/reservations/${createRes.body.id}`)
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
});
