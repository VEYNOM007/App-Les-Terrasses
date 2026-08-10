import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AuthModule } from '../auth/auth.module';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
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
 * Tests e2e HTTP — routes admin des médias d'unité
 * (POST /v1/admin/units/:unitId/media, PATCH/DELETE /v1/admin/media/:id).
 *
 * Vérifie le wiring Nest des guards : sans JWT -> 401, ACHETEUR -> 403,
 * ADMIN -> 201/200/200 (R6 : toute route /admin/* doit être ADMIN-only).
 *
 * Env vars (JWT_SECRET, DATABASE_URL, etc.) sont positionnées dans
 * jest.setup.ts exécuté avant tout import.
 */

const API_PREFIX = 'v1';

describe('ProjectModule — e2e HTTP médias admin (supertest)', () => {
  let app: INestApplication;
  const testPrisma = getTestPrisma();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule, AuthModule],
      controllers: [ProjectController],
      providers: [ProjectService],
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

  // ──────────────────────────────────────────────────
  // POST /v1/admin/units/:unitId/media
  // ──────────────────────────────────────────────────

  it('POST /admin/units/:unitId/media sans JWT -> 401 Unauthorized', async () => {
    const { units } = await createProjectWithBlockAndUnits(1);

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/units/${units[0].id}/media`)
      .send({ type: 'PHOTO', url: 'https://cdn.example.com/photo.jpg' });

    expect(res.status).toBe(401);
  });

  it('POST /admin/units/:unitId/media par un ACHETEUR -> 403 Forbidden', async () => {
    await createUserFixture({ email: 'acheteur-media@test.tg', phone: '+22851000001', password: 'Secret123!' });
    const { units } = await createProjectWithBlockAndUnits(1);
    const token = await loginAndGetToken('acheteur-media@test.tg', 'Secret123!');

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/units/${units[0].id}/media`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'PHOTO', url: 'https://cdn.example.com/photo.jpg' });

    expect(res.status).toBe(403);
  });

  it('POST /admin/units/:unitId/media par un ADMIN -> 201, média créé avec sortOrder 0', async () => {
    await createUserFixture({ email: 'admin-media@test.tg', phone: '+22851000002', password: 'Secret123!', role: 'ADMIN' });
    const { units } = await createProjectWithBlockAndUnits(1);
    const token = await loginAndGetToken('admin-media@test.tg', 'Secret123!');

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/units/${units[0].id}/media`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'RENDU_3D', url: 'https://cdn.example.com/3d.png', altText: 'Vue artiste' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      unitId: units[0].id,
      type: 'RENDU_3D',
      url: 'https://cdn.example.com/3d.png',
      altText: 'Vue artiste',
      sortOrder: 0,
    });
    expect(res.body).toHaveProperty('id');

    const inDb = await testPrisma.unitMedia.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(inDb.unitId).toBe(units[0].id);
  });

  it('POST /admin/units/:unitId/media avec un type invalide -> 400 (validation DTO)', async () => {
    await createUserFixture({ email: 'admin-media2@test.tg', phone: '+22851000003', password: 'Secret123!', role: 'ADMIN' });
    const { units } = await createProjectWithBlockAndUnits(1);
    const token = await loginAndGetToken('admin-media2@test.tg', 'Secret123!');

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/units/${units[0].id}/media`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'VIDEO', url: 'https://cdn.example.com/v.mp4' });

    expect(res.status).toBe(400);
  });

  // ──────────────────────────────────────────────────
  // PATCH /v1/admin/media/:id
  // ──────────────────────────────────────────────────

  it('PATCH /admin/media/:id par un ADMIN -> 200, média mis à jour', async () => {
    await createUserFixture({ email: 'admin-media3@test.tg', phone: '+22851000004', password: 'Secret123!', role: 'ADMIN' });
    const { units } = await createProjectWithBlockAndUnits(1);
    const media = await testPrisma.unitMedia.create({
      data: {
        unitId: units[0].id,
        type: 'PHOTO',
        url: 'https://cdn.example.com/old.jpg',
        sortOrder: 1,
      },
    });
    const token = await loginAndGetToken('admin-media3@test.tg', 'Secret123!');

    const res = await request(app.getHttpServer())
      .patch(`/${API_PREFIX}/admin/media/${media.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://cdn.example.com/new.jpg', sortOrder: 5 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: media.id, url: 'https://cdn.example.com/new.jpg', sortOrder: 5 });
  });

  it('PATCH /admin/media/:id par un ACHETEUR -> 403 Forbidden', async () => {
    await createUserFixture({ email: 'acheteur-media2@test.tg', phone: '+22851000005', password: 'Secret123!', role: 'ADMIN' });
    await createUserFixture({ email: 'acheteur-media3@test.tg', phone: '+22851000006', password: 'Secret123!' });
    const { units } = await createProjectWithBlockAndUnits(1);
    const media = await testPrisma.unitMedia.create({
      data: { unitId: units[0].id, type: 'PHOTO', url: 'https://cdn.example.com/old.jpg', sortOrder: 1 },
    });
    const token = await loginAndGetToken('acheteur-media3@test.tg', 'Secret123!');

    const res = await request(app.getHttpServer())
      .patch(`/${API_PREFIX}/admin/media/${media.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://cdn.example.com/new.jpg' });

    expect(res.status).toBe(403);
  });

  // ──────────────────────────────────────────────────
  // DELETE /v1/admin/media/:id
  // ──────────────────────────────────────────────────

  it('DELETE /admin/media/:id par un ADMIN -> 200, média supprimé', async () => {
    await createUserFixture({ email: 'admin-media4@test.tg', phone: '+22851000007', password: 'Secret123!', role: 'ADMIN' });
    const { units } = await createProjectWithBlockAndUnits(1);
    const media = await testPrisma.unitMedia.create({
      data: { unitId: units[0].id, type: 'PHOTO', url: 'https://cdn.example.com/old.jpg', sortOrder: 1 },
    });
    const token = await loginAndGetToken('admin-media4@test.tg', 'Secret123!');

    const res = await request(app.getHttpServer())
      .delete(`/${API_PREFIX}/admin/media/${media.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const inDb = await testPrisma.unitMedia.findUnique({ where: { id: media.id } });
    expect(inDb).toBeNull();
  });

  it('DELETE /admin/media/:id par un ACHETEUR -> 403 Forbidden', async () => {
    await createUserFixture({ email: 'acheteur-media4@test.tg', phone: '+22851000008', password: 'Secret123!' });
    const { units } = await createProjectWithBlockAndUnits(1);
    const media = await testPrisma.unitMedia.create({
      data: { unitId: units[0].id, type: 'PHOTO', url: 'https://cdn.example.com/old.jpg', sortOrder: 1 },
    });
    const token = await loginAndGetToken('acheteur-media4@test.tg', 'Secret123!');

    const res = await request(app.getHttpServer())
      .delete(`/${API_PREFIX}/admin/media/${media.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('DELETE /admin/media/:id inexistant par un ADMIN -> 404 Not Found', async () => {
    await createUserFixture({ email: 'admin-media5@test.tg', phone: '+22851000009', password: 'Secret123!', role: 'ADMIN' });
    const token = await loginAndGetToken('admin-media5@test.tg', 'Secret123!');

    const res = await request(app.getHttpServer())
      .delete(`/${API_PREFIX}/admin/media/media-inconnue`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
