import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AuthModule } from '../auth/auth.module';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CatalogController } from '../catalog/catalog.controller';
import { CatalogService } from '../catalog/catalog.service';
import {
  cleanupTestDatabase,
  createUserFixture,
  createProjectWithBlockAndUnits,
  disconnectTestPrisma,
  extractCookieValue,
  getTestPrisma,
} from '../../common/testing/test-db.helper';
import { UnitStatus, ReservationStatus } from '@prisma/client';

/**
 * Tests e2e HTTP — routes admin de suppression / archivage d'unité
 * (DELETE /v1/admin/units/:id) et retrait du catalogue public (statut
 * ARCHIVE exclu de getTypologies / getUnit).
 *
 * Le comportement est testé à la racine : ARCHIVE est le mécanisme principal
 * (données conservées, restauration en un clic) ; le DELETE SQL est un filet
 * de sécurité refusant toute unité avec un historique de réservation, même
 * ANNULEE (Q2 — « interdire tant que la moindre réservation existe »).
 */

const API_PREFIX = 'v1';

describe('ProjectModule — e2e HTTP suppression/archivage d’unité (supertest)', () => {
  let app: INestApplication;
  const testPrisma = getTestPrisma();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule, AuthModule],
      controllers: [ProjectController, CatalogController],
      providers: [ProjectService, CatalogService],
    })
      .overrideProvider(PrismaService)
      .useValue(testPrisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
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
  });

  async function loginAndGetToken(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/login`)
      .send({ email, password });
    const token = extractCookieValue(res, 'access_token');
    if (!token) throw new Error('access_token absent du Set-Cookie après login');
    return token;
  }

  async function loginAsAdmin(email: string): Promise<string> {
    return loginAndGetToken(email, 'Secret123!');
  }

  // ──────────────────────────────────────────────
  // DELETE /v1/admin/units/:id — filet de sécurité
  // ──────────────────────────────────────────────

  it('DELETE /admin/units/:id sans JWT -> 401 Unauthorized', async () => {
    const { units } = await createProjectWithBlockAndUnits(1);

    const res = await request(app.getHttpServer()).delete(`/${API_PREFIX}/admin/units/${units[0].id}`);

    expect(res.status).toBe(401);
  });

  it('DELETE /admin/units/:id par un ACHETEUR -> 403 Forbidden', async () => {
    await createUserFixture({ email: 'acheteur-del@test.tg', phone: '+22851000101', password: 'Secret123!' });
    const { units } = await createProjectWithBlockAndUnits(1);
    const token = await loginAndGetToken('acheteur-del@test.tg', 'Secret123!');

    const res = await request(app.getHttpServer())
      .delete(`/${API_PREFIX}/admin/units/${units[0].id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('DELETE /admin/units/:id inexistant par un ADMIN -> 404 Not Found', async () => {
    await createUserFixture({ email: 'admin-del0@test.tg', phone: '+22851000102', password: 'Secret123!', role: 'ADMIN' });
    const token = await loginAsAdmin('admin-del0@test.tg');

    const res = await request(app.getHttpServer())
      .delete(`/${API_PREFIX}/admin/units/unit-inconnue`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('DELETE /admin/units/:id par un ADMIN sans aucune réservation -> 200, unité supprimée (médias en cascade)', async () => {
    await createUserFixture({ email: 'admin-del1@test.tg', phone: '+22851000103', password: 'Secret123!', role: 'ADMIN' });
    const { units } = await createProjectWithBlockAndUnits(1);
    await testPrisma.unitMedia.create({
      data: { unitId: units[0].id, type: 'PHOTO', url: 'https://cdn.example.com/u.jpg', sortOrder: 0 },
    });
    const token = await loginAsAdmin('admin-del1@test.tg');

    const res = await request(app.getHttpServer())
      .delete(`/${API_PREFIX}/admin/units/${units[0].id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const inDb = await testPrisma.unit.findUnique({ where: { id: units[0].id } });
    expect(inDb).toBeNull();
    const mediaInDb = await testPrisma.unitMedia.findMany({ where: { unitId: units[0].id } });
    expect(mediaInDb).toHaveLength(0);
  });

  it('DELETE /admin/units/:id avec réservation EN_ATTENTE -> 409 (historique bloquant)', async () => {
    await createUserFixture({ email: 'admin-del2@test.tg', phone: '+22851000104', password: 'Secret123!', role: 'ADMIN' });
    const { units } = await createProjectWithBlockAndUnits(1);
    const acheteur = await createUserFixture();
    await testPrisma.reservation.create({
      data: {
        unitId: units[0].id,
        userId: acheteur.id,
        status: ReservationStatus.EN_ATTENTE,
        lockExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });
    const token = await loginAsAdmin('admin-del2@test.tg');

    const res = await request(app.getHttpServer())
      .delete(`/${API_PREFIX}/admin/units/${units[0].id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    const inDb = await testPrisma.unit.findUnique({ where: { id: units[0].id } });
    expect(inDb).not.toBeNull();
  });

  it('DELETE /admin/units/:id avec réservation ANNULEE -> 409, aucune exception', async () => {
    await createUserFixture({ email: 'admin-del3@test.tg', phone: '+22851000105', password: 'Secret123!', role: 'ADMIN' });
    const { units } = await createProjectWithBlockAndUnits(1);
    const acheteur = await createUserFixture();
    await testPrisma.reservation.create({
      data: {
        unitId: units[0].id,
        userId: acheteur.id,
        status: ReservationStatus.ANNULEE,
        lockExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });
    const token = await loginAsAdmin('admin-del3@test.tg');

    const res = await request(app.getHttpServer())
      .delete(`/${API_PREFIX}/admin/units/${units[0].id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    // L'historique (même annulé) et l'unité restent intacts : aucune donnée détruite.
    const resCount = await testPrisma.reservation.count({ where: { unitId: units[0].id } });
    expect(resCount).toBe(1);
    const unitInDb = await testPrisma.unit.findUnique({ where: { id: units[0].id } });
    expect(unitInDb).not.toBeNull();
  });

  it('DELETE /admin/units/:id avec réservation CONFIRMEE (échéancier) -> 409', async () => {
    await createUserFixture({ email: 'admin-del4@test.tg', phone: '+22851000106', password: 'Secret123!', role: 'ADMIN' });
    const { project, units } = await createProjectWithBlockAndUnits(1);
    const acheteur = await createUserFixture();
    const reservation = await testPrisma.reservation.create({
      data: {
        unitId: units[0].id,
        userId: acheteur.id,
        status: ReservationStatus.CONFIRMEE,
        lockExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });
    await testPrisma.paymentSchedule.create({
      data: {
        reservationId: reservation.id,
        totalAmount: 24_000_000,
        currency: 'XOF',
        installments: { create: { label: 'Acompte', amount: 2_400_000, dueDate: new Date(), status: 'PAYE' } },
      },
    });
    void project;
    const token = await loginAsAdmin('admin-del4@test.tg');

    const res = await request(app.getHttpServer())
      .delete(`/${API_PREFIX}/admin/units/${units[0].id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    const scheduleInDb = await testPrisma.paymentSchedule.findFirst({ where: { reservationId: reservation.id } });
    expect(scheduleInDb).not.toBeNull();
  });

  // ──────────────────────────────────────────────
  // PATCH status: ARCHIVE — mécanisme principal
  // ──────────────────────────────────────────────

  it('PATCH /admin/units/:id status=ARCHIVE par un ADMIN -> 200, données médias conservées', async () => {
    await createUserFixture({ email: 'admin-arc@test.tg', phone: '+22851000107', password: 'Secret123!', role: 'ADMIN' });
    const { units } = await createProjectWithBlockAndUnits(1);
    await testPrisma.unitMedia.create({
      data: { unitId: units[0].id, type: 'PHOTO', url: 'https://cdn.example.com/arch.jpg', sortOrder: 0 },
    });
    const token = await loginAsAdmin('admin-arc@test.tg');

    const res = await request(app.getHttpServer())
      .patch(`/${API_PREFIX}/admin/units/${units[0].id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ARCHIVE' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(UnitStatus.ARCHIVE);
    const inDb = await testPrisma.unit.findUniqueOrThrow({ where: { id: units[0].id } });
    expect(inDb.status).toBe(UnitStatus.ARCHIVE);
    const mediaInDb = await testPrisma.unitMedia.findMany({ where: { unitId: units[0].id } });
    expect(mediaInDb).toHaveLength(1);
  });

  it('une unité archivée disparaît de la fiche publique et des typologies', async () => {
    await createUserFixture({ email: 'admin-arc2@test.tg', phone: '+22851000108', password: 'Secret123!', role: 'ADMIN' });
    const { units } = await createProjectWithBlockAndUnits(1, { unitType: 'T2' });

    const beforeTypologies = await request(app.getHttpServer()).get(`/${API_PREFIX}/catalog/typologies`);
    expect(beforeTypologies.status).toBe(200);
    const t2before = beforeTypologies.body.find((t: { type: string }) => t.type === 'T2');
    expect(t2before.totalUnits).toBe(1);

    await testPrisma.unit.update({ where: { id: units[0].id }, data: { status: UnitStatus.ARCHIVE } });

    const afterTypologies = await request(app.getHttpServer()).get(`/${API_PREFIX}/catalog/typologies`);
    expect(afterTypologies.status).toBe(200);
    const t2after = afterTypologies.body.find((t: { type: string }) => t.type === 'T2');
    expect(t2after).toBeUndefined();

    const unitRes = await request(app.getHttpServer()).get(`/${API_PREFIX}/catalog/units/${units[0].id}`);
    // Le controller renvoie un corps vide (null/[]) quand l'unité n'est pas
    // visible publiquement ; l'essentiel : plus de fiche exposée (aucun id).
    expect(unitRes.body.id).toBeUndefined();
  });

  it('une unité archivée ne peut plus avoir d’échéancier prévisualisé en public', async () => {
    const { units } = await createProjectWithBlockAndUnits(1, { unitType: 'T2' });
    await testPrisma.unit.update({ where: { id: units[0].id }, data: { status: UnitStatus.ARCHIVE } });

    const res = await request(app.getHttpServer()).get(
      `/${API_PREFIX}/catalog/units/${units[0].id}/payment-preview`,
    );

    expect(res.status).toBe(404);
  });
});