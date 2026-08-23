import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AuthModule } from '../auth/auth.module';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
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
 * (POST /v1/admin/units/:unitId/media, POST …/media/upload,
 * PATCH/DELETE /v1/admin/media/:id).
 *
 * Vérifie le wiring Nest des guards : sans JWT -> 401, ACHETEUR -> 403,
 * ADMIN -> 201/201/200/200 (R6 : toute route /admin/* doit être ADMIN-only).
 *
 * Le StorageService est mocké : aucun appel B2 réel — on vérifie que le
 * service de stockage reçoit bien la clé interne et le ContentType attendus,
 * et que la suppression d'un média d'origine B2 déclenche la purge du blob.
 *
 * Env vars (JWT_SECRET, DATABASE_URL, etc.) sont positionnées dans
 * jest.setup.ts exécuté avant tout import.
 */

const API_PREFIX = 'v1';
const PUBLIC_URL_PREFIX = 'https://public.b2.example.com/';

const mockStorage = {
  putObjectPublic: jest.fn().mockResolvedValue(undefined),
  getPublicUrl: jest.fn((key: string) => `${PUBLIC_URL_PREFIX}${key}`),
  deleteObjectPublic: jest.fn().mockResolvedValue(undefined),
  extractKeyFromPublicUrl: jest.fn((url: string) =>
    url.startsWith(PUBLIC_URL_PREFIX) ? url.slice(PUBLIC_URL_PREFIX.length) : null,
  ),
};

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
      .overrideProvider(StorageService)
      .useValue(mockStorage)
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
    jest.clearAllMocks();
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
  // POST /v1/admin/units/:unitId/media/upload (multipart)
  // ──────────────────────────────────────────────────

  it('POST /admin/units/:unitId/media/upload par un ADMIN -> 201, upload B2 + URL publique stable', async () => {
    await createUserFixture({ email: 'admin-up1@test.tg', phone: '+22851000010', password: 'Secret123!', role: 'ADMIN' });
    const { units } = await createProjectWithBlockAndUnits(1);
    const token = await loginAndGetToken('admin-up1@test.tg', 'Secret123!');
    const fileBuffer = Buffer.from('fake-png-bytes');

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/units/${units[0].id}/media/upload`)
      .set('Authorization', `Bearer ${token}`)
      .field('type', 'RENDU_3D')
      .field('altText', 'Vue artiste')
      .attach('file', fileBuffer, { filename: 'rendu.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.unitId).toBe(units[0].id);
    expect(res.body.type).toBe('RENDU_3D');
    expect(res.body.altText).toBe('Vue artiste');
    expect(res.body.sortOrder).toBe(0);
    expect(res.body.url).toMatch(new RegExp(`^${PUBLIC_URL_PREFIX}unit-media/[0-9a-f-]+\\.png$`));

    expect(mockStorage.putObjectPublic).toHaveBeenCalledTimes(1);
    const [key, body, contentType] = mockStorage.putObjectPublic.mock.calls[0];
    expect(key).toMatch(/^unit-media\/[0-9a-f-]+\.png$/);
    expect(body).toEqual(fileBuffer);
    expect(contentType).toBe('image/png');

    const inDb = await testPrisma.unitMedia.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(inDb.unitId).toBe(units[0].id);
  });

  it('POST …/media/upload sans fichier par un ADMIN -> 400', async () => {
    await createUserFixture({ email: 'admin-up2@test.tg', phone: '+22851000011', password: 'Secret123!', role: 'ADMIN' });
    const { units } = await createProjectWithBlockAndUnits(1);
    const token = await loginAndGetToken('admin-up2@test.tg', 'Secret123!');

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/units/${units[0].id}/media/upload`)
      .set('Authorization', `Bearer ${token}`)
      .field('type', 'PHOTO');

    expect(res.status).toBe(400);
    expect(mockStorage.putObjectPublic).not.toHaveBeenCalled();
  });

  it('POST …/media/upload avec un MIME interdit -> 400 (whitelist PNG/JPG/WebP/PDF)', async () => {
    await createUserFixture({ email: 'admin-up3@test.tg', phone: '+22851000012', password: 'Secret123!', role: 'ADMIN' });
    const { units } = await createProjectWithBlockAndUnits(1);
    const token = await loginAndGetToken('admin-up3@test.tg', 'Secret123!');

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/units/${units[0].id}/media/upload`)
      .set('Authorization', `Bearer ${token}`)
      .field('type', 'PHOTO')
      .attach('file', Buffer.from('not-an-image'), { filename: 'malware.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
    expect(mockStorage.putObjectPublic).not.toHaveBeenCalled();
  });

  it('POST …/media/upload par un ACHETEUR -> 403 Forbidden', async () => {
    await createUserFixture({ email: 'acheteur-up1@test.tg', phone: '+22851000013', password: 'Secret123!' });
    const { units } = await createProjectWithBlockAndUnits(1);
    const token = await loginAndGetToken('acheteur-up1@test.tg', 'Secret123!');

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/units/${units[0].id}/media/upload`)
      .set('Authorization', `Bearer ${token}`)
      .field('type', 'PHOTO')
      .attach('file', Buffer.from('x'), { filename: 'p.png', contentType: 'image/png' });

    expect(res.status).toBe(403);
    expect(mockStorage.putObjectPublic).not.toHaveBeenCalled();
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

  it('DELETE /admin/media/:id (média venu du bucket public) -> purge du blob B2', async () => {
    await createUserFixture({ email: 'admin-media6@test.tg', phone: '+22851000014', password: 'Secret123!', role: 'ADMIN' });
    const { units } = await createProjectWithBlockAndUnits(1);
    const media = await testPrisma.unitMedia.create({
      data: {
        unitId: units[0].id,
        type: 'PHOTO',
        url: `${PUBLIC_URL_PREFIX}unit-media/abc-123.png`,
        sortOrder: 1,
      },
    });
    const token = await loginAndGetToken('admin-media6@test.tg', 'Secret123!');

    const res = await request(app.getHttpServer())
      .delete(`/${API_PREFIX}/admin/media/${media.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockStorage.extractKeyFromPublicUrl).toHaveBeenCalledWith(
      `${PUBLIC_URL_PREFIX}unit-media/abc-123.png`,
    );
    expect(mockStorage.deleteObjectPublic).toHaveBeenCalledWith('unit-media/abc-123.png');
  });

  it('DELETE /admin/media/:id (URL externe) -> pas de purge B2', async () => {
    await createUserFixture({ email: 'admin-media7@test.tg', phone: '+22851000015', password: 'Secret123!', role: 'ADMIN' });
    const { units } = await createProjectWithBlockAndUnits(1);
    const media = await testPrisma.unitMedia.create({
      data: { unitId: units[0].id, type: 'PHOTO', url: 'https://cdn.example.com/old.jpg', sortOrder: 1 },
    });
    const token = await loginAndGetToken('admin-media7@test.tg', 'Secret123!');

    const res = await request(app.getHttpServer())
      .delete(`/${API_PREFIX}/admin/media/${media.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockStorage.deleteObjectPublic).not.toHaveBeenCalled();
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

  // ──────────────────────────────────────────────────
  // POST /v1/admin/projects/:projectId/image/upload
  // ──────────────────────────────────────────────────

  it('POST /admin/projects/:projectId/image/upload par un ADMIN -> 201, URL B2 publique', async () => {
    await createUserFixture({ email: 'admin-pimg1@test.tg', phone: '+22851000020', password: 'Secret123!', role: 'ADMIN' });
    const { project } = await createProjectWithBlockAndUnits(1);
    const token = await loginAndGetToken('admin-pimg1@test.tg', 'Secret123!');
    const fileBuffer = Buffer.from('fake-png-plan-de-masse');

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/projects/${project.id}/image/upload`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', fileBuffer, { filename: 'plan-masse.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(new RegExp(`^${PUBLIC_URL_PREFIX}project-media/[0-9a-f-]+\\.png$`));

    expect(mockStorage.putObjectPublic).toHaveBeenCalledTimes(1);
    const [key, body, contentType] = mockStorage.putObjectPublic.mock.calls[0];
    expect(key).toMatch(/^project-media\/[0-9a-f-]+\.png$/);
    expect(body).toEqual(fileBuffer);
    expect(contentType).toBe('image/png');
  });

  it('POST /admin/projects/:projectId/image/upload sans JWT -> 401 Unauthorized', async () => {
    const { project } = await createProjectWithBlockAndUnits(1);

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/projects/${project.id}/image/upload`)
      .attach('file', Buffer.from('x'), { filename: 'p.png', contentType: 'image/png' });

    expect(res.status).toBe(401);
  });

  it('POST /admin/projects/:projectId/image/upload par un ACHETEUR -> 403 Forbidden', async () => {
    await createUserFixture({ email: 'acheteur-pimg@test.tg', phone: '+22851000021', password: 'Secret123!' });
    const { project } = await createProjectWithBlockAndUnits(1);
    const token = await loginAndGetToken('acheteur-pimg@test.tg', 'Secret123!');

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/projects/${project.id}/image/upload`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('x'), { filename: 'p.png', contentType: 'image/png' });

    expect(res.status).toBe(403);
    expect(mockStorage.putObjectPublic).not.toHaveBeenCalled();
  });

  it('POST /admin/projects/:projectId/image/upload sans fichier -> 400', async () => {
    await createUserFixture({ email: 'admin-pimg2@test.tg', phone: '+22851000022', password: 'Secret123!', role: 'ADMIN' });
    const { project } = await createProjectWithBlockAndUnits(1);
    const token = await loginAndGetToken('admin-pimg2@test.tg', 'Secret123!');

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/projects/${project.id}/image/upload`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(mockStorage.putObjectPublic).not.toHaveBeenCalled();
  });

  it('POST /admin/projects/:projectId/image/upload avec MIME interdit -> 400', async () => {
    await createUserFixture({ email: 'admin-pimg3@test.tg', phone: '+22851000023', password: 'Secret123!', role: 'ADMIN' });
    const { project } = await createProjectWithBlockAndUnits(1);
    const token = await loginAndGetToken('admin-pimg3@test.tg', 'Secret123!');

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/projects/${project.id}/image/upload`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('not-an-image'), { filename: 'plan.gif', contentType: 'image/gif' });

    expect(res.status).toBe(400);
    expect(mockStorage.putObjectPublic).not.toHaveBeenCalled();
  });

  it('POST /admin/projects/:projectId/image/upload projet inexistant -> 404', async () => {
    await createUserFixture({ email: 'admin-pimg4@test.tg', phone: '+22851000024', password: 'Secret123!', role: 'ADMIN' });
    const token = await loginAndGetToken('admin-pimg4@test.tg', 'Secret123!');

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/projects/non-existent-id/image/upload`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('x'), { filename: 'p.png', contentType: 'image/png' });

    expect(res.status).toBe(404);
    expect(mockStorage.putObjectPublic).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────
  // GET /v1/admin/blocks/:blockId/views
  // ──────────────────────────────────────────────────

  it('GET /admin/blocks/:blockId/views sans JWT -> 401 Unauthorized', async () => {
    const { block } = await createProjectWithBlockAndUnits(1);

    const res = await request(app.getHttpServer())
      .get(`/${API_PREFIX}/admin/blocks/${block.id}/views`);

    expect(res.status).toBe(401);
  });

  it('GET /admin/blocks/:blockId/views par un ACHETEUR -> 403 Forbidden', async () => {
    await createUserFixture({ email: 'acheteur-bviews@test.tg', phone: '+22851000030', password: 'Secret123!' });
    const { block } = await createProjectWithBlockAndUnits(1);
    const token = await loginAndGetToken('acheteur-bviews@test.tg', 'Secret123!');

    const res = await request(app.getHttpServer())
      .get(`/${API_PREFIX}/admin/blocks/${block.id}/views`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('GET /admin/blocks/:blockId/views par un ADMIN -> 200, views null pour un bloc neuf', async () => {
    await createUserFixture({ email: 'admin-bviews1@test.tg', phone: '+22851000031', password: 'Secret123!', role: 'ADMIN' });
    const { block } = await createProjectWithBlockAndUnits(1);
    const token = await loginAndGetToken('admin-bviews1@test.tg', 'Secret123!');

    const res = await request(app.getHttpServer())
      .get(`/${API_PREFIX}/admin/blocks/${block.id}/views`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  });

  // ──────────────────────────────────────────────────
  // PATCH /v1/admin/blocks/:blockId/views
  // ──────────────────────────────────────────────────

  it('PATCH /admin/blocks/:blockId/views sans JWT -> 401 Unauthorized', async () => {
    const { block } = await createProjectWithBlockAndUnits(1);

    const res = await request(app.getHttpServer())
      .patch(`/${API_PREFIX}/admin/blocks/${block.id}/views`)
      .send({ views: [] });

    expect(res.status).toBe(401);
  });

  it('PATCH /admin/blocks/:blockId/views par un ACHETEUR -> 403 Forbidden', async () => {
    await createUserFixture({ email: 'acheteur-bviews2@test.tg', phone: '+22851000032', password: 'Secret123!' });
    const { block } = await createProjectWithBlockAndUnits(1);
    const token = await loginAndGetToken('acheteur-bviews2@test.tg', 'Secret123!');

    const res = await request(app.getHttpServer())
      .patch(`/${API_PREFIX}/admin/blocks/${block.id}/views`)
      .set('Authorization', `Bearer ${token}`)
      .send({ views: [] });

    expect(res.status).toBe(403);
  });

  it('PATCH /admin/blocks/:blockId/views par un ADMIN -> 200, vues enregistrées', async () => {
    await createUserFixture({ email: 'admin-bviews2@test.tg', phone: '+22851000033', password: 'Secret123!', role: 'ADMIN' });
    const { block } = await createProjectWithBlockAndUnits(1);
    const token = await loginAndGetToken('admin-bviews2@test.tg', 'Secret123!');

    const views = [
      {
        id: 'view-floor-1',
        title: 'Plan Étage 1',
        subtitle: 'Vue du premier niveau',
        category: 'floorplan',
        imageUrl: 'https://b2.example.com/project-media/test.png',
        description: 'Disposition des appartements au R+1',
        hotspots: [
          { id: 'hs-1', label: 'T2 Nord', targetType: 'UNIT', targetId: 'unit-x', top: '40%', left: '30%' },
        ],
      },
    ];

    const res = await request(app.getHttpServer())
      .patch(`/${API_PREFIX}/admin/blocks/${block.id}/views`)
      .set('Authorization', `Bearer ${token}`)
      .send({ views });

    expect(res.status).toBe(200);
    expect(res.body.views).toHaveLength(1);
    expect(res.body.views[0].id).toBe('view-floor-1');
    expect(res.body.views[0].hotspots[0].targetType).toBe('UNIT');

    const inDb = await testPrisma.block.findUniqueOrThrow({ where: { id: block.id } });
    expect(inDb.views).not.toBeNull();
  });

  it('PATCH /admin/blocks/:blockId/views avec targetType invalide -> 400 (validation DTO)', async () => {
    await createUserFixture({ email: 'admin-bviews3@test.tg', phone: '+22851000034', password: 'Secret123!', role: 'ADMIN' });
    const { block } = await createProjectWithBlockAndUnits(1);
    const token = await loginAndGetToken('admin-bviews3@test.tg', 'Secret123!');

    const res = await request(app.getHttpServer())
      .patch(`/${API_PREFIX}/admin/blocks/${block.id}/views`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        views: [
          {
            id: 'v1', title: 'T', subtitle: 'S', category: 'floorplan',
            imageUrl: 'https://example.com/img.png', description: 'D',
            hotspots: [{ id: 'hs', label: 'X', targetType: 'FOO', targetId: 'y', top: '10%', left: '10%' }],
          },
        ],
      });

    expect(res.status).toBe(400);
  });

  it('PATCH /admin/blocks/:blockId/views avec champ requis manquant (imageUrl) -> 400', async () => {
    await createUserFixture({ email: 'admin-bviews4@test.tg', phone: '+22851000035', password: 'Secret123!', role: 'ADMIN' });
    const { block } = await createProjectWithBlockAndUnits(1);
    const token = await loginAndGetToken('admin-bviews4@test.tg', 'Secret123!');

    const res = await request(app.getHttpServer())
      .patch(`/${API_PREFIX}/admin/blocks/${block.id}/views`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        views: [
          {
            id: 'v1', title: 'T', subtitle: 'S', category: 'floorplan',
            description: 'D',
          },
        ],
      });

    expect(res.status).toBe(400);
  });

  it('PATCH /admin/projects/:id avec targetBlockId dans views -> 400 (rejet ancien format)', async () => {
    await createUserFixture({ email: 'admin-pviews1@test.tg', phone: '+22851000050', password: 'Secret123!', role: 'ADMIN' });
    const { project } = await createProjectWithBlockAndUnits(1);
    const token = await loginAndGetToken('admin-pviews1@test.tg', 'Secret123!');

    const res = await request(app.getHttpServer())
      .patch(`/${API_PREFIX}/admin/projects/${project.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        views: [
          {
            id: 'v1', title: 'T', subtitle: 'S', category: 'masterplan',
            imageUrl: 'https://example.com/img.png', description: 'D',
            hotspots: [{ id: 'hs', label: 'X', targetBlockId: 'unit-a', top: '10%', left: '10%' }],
          },
        ],
      });

    expect(res.status).toBe(400);
  });

  // ──────────────────────────────────────────────────
  // POST /v1/admin/blocks/:blockId/image/upload
  // ──────────────────────────────────────────────────

  it('POST /admin/blocks/:blockId/image/upload par un ADMIN -> 201, URL B2 publique', async () => {
    await createUserFixture({ email: 'admin-bimg1@test.tg', phone: '+22851000040', password: 'Secret123!', role: 'ADMIN' });
    const { block } = await createProjectWithBlockAndUnits(1);
    const token = await loginAndGetToken('admin-bimg1@test.tg', 'Secret123!');
    const fileBuffer = Buffer.from('fake-png-floorplan');

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/blocks/${block.id}/image/upload`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', fileBuffer, { filename: 'floorplan.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(new RegExp(`^${PUBLIC_URL_PREFIX}project-media/[0-9a-f-]+\\.png$`));

    expect(mockStorage.putObjectPublic).toHaveBeenCalledTimes(1);
    const [key, body, contentType] = mockStorage.putObjectPublic.mock.calls[0];
    expect(key).toMatch(/^project-media\/[0-9a-f-]+\.png$/);
    expect(body).toEqual(fileBuffer);
    expect(contentType).toBe('image/png');
  });

  it('POST /admin/blocks/:blockId/image/upload sans JWT -> 401 Unauthorized', async () => {
    const { block } = await createProjectWithBlockAndUnits(1);

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/blocks/${block.id}/image/upload`)
      .attach('file', Buffer.from('x'), { filename: 'p.png', contentType: 'image/png' });

    expect(res.status).toBe(401);
  });

  it('POST /admin/blocks/:blockId/image/upload par un ACHETEUR -> 403 Forbidden', async () => {
    await createUserFixture({ email: 'acheteur-bimg@test.tg', phone: '+22851000041', password: 'Secret123!' });
    const { block } = await createProjectWithBlockAndUnits(1);
    const token = await loginAndGetToken('acheteur-bimg@test.tg', 'Secret123!');

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/blocks/${block.id}/image/upload`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('x'), { filename: 'p.png', contentType: 'image/png' });

    expect(res.status).toBe(403);
    expect(mockStorage.putObjectPublic).not.toHaveBeenCalled();
  });

  it('POST /admin/blocks/:blockId/image/upload sans fichier -> 400', async () => {
    await createUserFixture({ email: 'admin-bimg2@test.tg', phone: '+22851000042', password: 'Secret123!', role: 'ADMIN' });
    const { block } = await createProjectWithBlockAndUnits(1);
    const token = await loginAndGetToken('admin-bimg2@test.tg', 'Secret123!');

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/blocks/${block.id}/image/upload`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(mockStorage.putObjectPublic).not.toHaveBeenCalled();
  });
});
