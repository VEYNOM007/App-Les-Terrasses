import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { KycStatus, UserRole } from '@prisma/client';
import { AuthModule } from '../auth/auth.module';
import { PortalModule } from './portal.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import {
  cleanupTestDatabase,
  createUserFixture,
  disconnectTestPrisma,
  extractCookieValue,
  getTestPrisma,
} from '../../common/testing/test-db.helper';

/**
 * Tests e2e HTTP — GET /v1/portal/kyc (dossier KYC de l'acheteur courant).
 * Le guard JWT réel bloque les invités (401) ; le portail reçoit le statut
 * et le motif de rejet de la dernière pièce — jamais la clé de fichier B2.
 */

const API_PREFIX = 'v1';

describe('PortalService — dossier KYC (e2e HTTP)', () => {
  let app: INestApplication;
  const testPrisma = getTestPrisma();
  const storage = { putObject: jest.fn(), getObject: jest.fn(), getSignedUrl: jest.fn(), deleteObject: jest.fn() };

  async function loginAndGetToken(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/login`)
      .send({ email, password });
    const token = extractCookieValue(res, 'access_token');
    if (!token) throw new Error('access_token absent du Set-Cookie après login');
    return token;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule, AuthModule, PortalModule],
    })
      .overrideProvider(PrismaService)
      .useValue(testPrisma)
      .overrideProvider(StorageService)
      .useValue(storage)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
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

  it('invité -> 401 (guard JWT réel)', async () => {
    const res = await request(app.getHttpServer()).get(`/${API_PREFIX}/portal/kyc`);
    expect(res.status).toBe(401);
  });

  it('compte sans pièce -> NON_SOUMIS avec latestDocument null', async () => {
    const user = await createUserFixture({
      email: `nokyc-${Date.now()}@test.tg`,
      role: UserRole.ACHETEUR,
      password: 'Secret123!',
    });
    const token = await loginAndGetToken(user.email, 'Secret123!');

    const res = await request(app.getHttpServer())
      .get(`/${API_PREFIX}/portal/kyc`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ kycStatus: KycStatus.NON_SOUMIS, latestDocument: null });
  });

  it('pièce rejetée -> expose le motif, sans jamais fuiter la clé B2', async () => {
    const user = await createUserFixture({
      email: `kyc-rej-${Date.now()}@test.tg`,
      role: UserRole.ACHETEUR,
      password: 'Secret123!',
    });
    await testPrisma.user.update({ where: { id: user.id }, data: { kycStatus: KycStatus.REJETE } });
    await testPrisma.document.create({
      data: {
        type: 'PIECE_IDENTITE',
        name: 'Pièce d\'identité — 14/08/2026',
        fileUrl: 'kyc/secret-b2-key.pdf',
        kycOwnerId: user.id,
        rejectedAt: new Date('2026-08-15T08:00:00.000Z'),
        rejectedReason: 'Document expiré — veuillez transmettre une pièce en cours de validité.',
      },
    });

    const token = await loginAndGetToken(user.email, 'Secret123!');
    const res = await request(app.getHttpServer())
      .get(`/${API_PREFIX}/portal/kyc`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.kycStatus).toBe(KycStatus.REJETE);
    expect(res.body.latestDocument).toMatchObject({
      name: 'Pièce d\'identité — 14/08/2026',
      rejectedReason: 'Document expiré — veuillez transmettre une pièce en cours de validité.',
    });
    expect(JSON.stringify(res.body)).not.toContain('secret-b2-key');
    expect(JSON.stringify(res.body)).not.toContain('fileUrl');
  });
});