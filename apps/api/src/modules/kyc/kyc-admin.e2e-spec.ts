import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { getQueueToken } from '@nestjs/bullmq';
import { DocumentType, KycStatus, UserRole } from '@prisma/client';
import { AuthModule } from '../auth/auth.module';
import { AdminKycController } from '../admin/admin-kyc.controller';
import { KycService } from './kyc.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { NotificationService } from '../notification/notification.service';
import { KYC_REJECTED_RETENTION_MS } from './kyc-retention.constants';
import {
  cleanupTestDatabase,
  createUserFixture,
  disconnectTestPrisma,
  extractCookieValue,
  getTestPrisma,
} from '../../common/testing/test-db.helper';

/**
 * Tests e2e HTTP - dossier KYC admin (/v1/admin/kyc)
 *
 * Coverage : guards (401 guest / 403 acheteur), liste, URL signée, rejet
 * (motif obligatoire via le ValidationPipe réel), validation. La queue
 * `kyc-document-retention`, Storage B2 et NotificationService sont mockés
 * comme providers locaux (aucun BullMQ/Redis réel : KycService n'en a
 * pas besoin, évite les handles de connexion bloquants) ; PrismaService
 * pointe sur DATABASE_URL_TEST.
 */

const API_PREFIX = 'v1';

describe('KYC Admin - e2e HTTP (supertest)', () => {
  let app: INestApplication;
  const testPrisma = getTestPrisma();
  let queueAdd: jest.Mock;
  let notifyUser: jest.Mock;

  beforeAll(async () => {
    queueAdd = jest.fn().mockResolvedValue({ id: 'job-e2e' });
    notifyUser = jest.fn().mockResolvedValue({ id: 'notif-e2e' });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule, AuthModule],
      controllers: [AdminKycController],
      providers: [
        KycService,
        {
          provide: StorageService,
          useValue: {
            getSignedUrl: jest.fn().mockResolvedValue('https://b2-signed/kyc/pièce.png'),
            putObject: jest.fn(),
            deleteObject: jest.fn(),
          },
        },
        { provide: NotificationService, useValue: { notifyUser } },
        { provide: getQueueToken('kyc-document-retention'), useValue: { add: queueAdd } },
      ],
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
    queueAdd.mockClear();
    notifyUser.mockClear();
  });

  async function loginAndGetToken(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/login`)
      .send({ email, password });
    const token = extractCookieValue(res, 'access_token');
    if (!token) throw new Error('access_token absent du Set-Cookie après login');
    return token;
  }

  async function createBuyerWithKycDoc(): Promise<{ buyerId: string; documentId: string }> {
    const buyer = await createUserFixture({ password: 'Secret123!' });
    const document = await testPrisma.document.create({
      data: {
        type: DocumentType.PIECE_IDENTITE,
        name: 'Pièce d\'identité — 2026-08-20',
        fileUrl: 'kyc/8f1eab-png',
        kycOwnerId: buyer.id,
      },
    });
    await testPrisma.user.update({
      where: { id: buyer.id },
      data: { kycStatus: KycStatus.EN_ATTENTE },
    });
    return { buyerId: buyer.id, documentId: document.id };
  }

  // ──────────────────────────────────────────────────
  // Guards
  // ──────────────────────────────────────────────────

  it('GET /admin/kyc sans JWT -> 401', async () => {
    const res = await request(app.getHttpServer()).get(`/${API_PREFIX}/admin/kyc`);
    expect(res.status).toBe(401);
  });

  it('GET /admin/kyc en tant qu\'acheteur -> 403', async () => {
    const buyer = await createUserFixture({ password: 'Secret123!' });
    const token = await loginAndGetToken(buyer.email, 'Secret123!');

    const res = await request(app.getHttpServer())
      .get(`/${API_PREFIX}/admin/kyc`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  // ──────────────────────────────────────────────────
  // Liste + consultation
  // ──────────────────────────────────────────────────

  it('GET /admin/kyc -> 200, dossiers ouverts avec la pièce la plus récente', async () => {
    const admin = await createUserFixture({ role: UserRole.ADMIN, password: 'Secret123!' });
    const token = await loginAndGetToken(admin.email, 'Secret123!');
    const { documentId } = await createBuyerWithKycDoc();

    const res = await request(app.getHttpServer())
      .get(`/${API_PREFIX}/admin/kyc`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const entry = res.body.find((u: { id: string }) => u.id !== admin.id);
    expect(entry.kycStatus).toBe('EN_ATTENTE');
    expect(entry.latestDocument.id).toBe(documentId);
    expect(entry.latestDocument.rejectedAt).toBeNull();
  });

  it('GET /admin/kyc/:documentId/file -> 200, URL signée B2', async () => {
    const admin = await createUserFixture({ role: UserRole.ADMIN, password: 'Secret123!' });
    const token = await loginAndGetToken(admin.email, 'Secret123!');
    const { documentId } = await createBuyerWithKycDoc();

    const res = await request(app.getHttpServer())
      .get(`/${API_PREFIX}/admin/kyc/${documentId}/file`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ url: 'https://b2-signed/kyc/pièce.png' });
  });

  // ──────────────────────────────────────────────────
  // Rejet
  // ──────────────────────────────────────────────────

  it('POST /admin/kyc/:id/reject sans motif -> 400 (ValidationPipe)', async () => {
    const admin = await createUserFixture({ role: UserRole.ADMIN, password: 'Secret123!' });
    const token = await loginAndGetToken(admin.email, 'Secret123!');
    const { documentId } = await createBuyerWithKycDoc();

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/kyc/${documentId}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: '' });

    expect(res.status).toBe(400);
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it('POST /admin/kyc/:id/reject avec motif -> 200, REJETE + purge planifiée 15 j + notification', async () => {
    const admin = await createUserFixture({ role: UserRole.ADMIN, password: 'Secret123!' });
    const token = await loginAndGetToken(admin.email, 'Secret123!');
    const { buyerId, documentId } = await createBuyerWithKycDoc();

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/kyc/${documentId}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Document flou, merci de renvoyer une photo nette.' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ documentId, kycStatus: 'REJETE' });

    const buyer = await testPrisma.user.findUniqueOrThrow({ where: { id: buyerId } });
    expect(buyer.kycStatus).toBe(KycStatus.REJETE);

    const document = await testPrisma.document.findUniqueOrThrow({ where: { id: documentId } });
    expect(document.rejectedAt).not.toBeNull();
    expect(document.rejectedReason).toBe('Document flou, merci de renvoyer une photo nette.');

    expect(queueAdd).toHaveBeenCalledWith(
      'retain-document',
      { documentId },
      { delay: KYC_REJECTED_RETENTION_MS, jobId: documentId },
    );
    expect(notifyUser).toHaveBeenCalledWith(
      buyerId,
      expect.objectContaining({
        title: 'Vérification d\'identité rejetée',
        body: expect.stringContaining('Document flou, merci de renvoyer une photo nette.'),
      }),
    );
  });

  it('POST /admin/kyc/:id/reject sur pièce déjà rejetée -> 409', async () => {
    const admin = await createUserFixture({ role: UserRole.ADMIN, password: 'Secret123!' });
    const token = await loginAndGetToken(admin.email, 'Secret123!');
    const { documentId } = await createBuyerWithKycDoc();
    await testPrisma.document.update({
      where: { id: documentId },
      data: { rejectedAt: new Date(), rejectedReason: 'Premier rejet' },
    });

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/kyc/${documentId}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Deuxième rejet' });

    expect(res.status).toBe(409);
    expect(queueAdd).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────
  // Validation
  // ──────────────────────────────────────────────────

  it('POST /admin/kyc/:id/approve -> 200, user VALIDE + notification', async () => {
    const admin = await createUserFixture({ role: UserRole.ADMIN, password: 'Secret123!' });
    const token = await loginAndGetToken(admin.email, 'Secret123!');
    const { buyerId, documentId } = await createBuyerWithKycDoc();

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/kyc/${documentId}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ documentId, kycStatus: 'VALIDE' });

    const buyer = await testPrisma.user.findUniqueOrThrow({ where: { id: buyerId } });
    expect(buyer.kycStatus).toBe(KycStatus.VALIDE);
    expect(notifyUser).toHaveBeenCalledWith(
      buyerId,
      expect.objectContaining({ title: 'Vérification d\'identité validée' }),
    );
  });

  it('POST /admin/kyc/:id/approve sur pièce rejetée -> 409', async () => {
    const admin = await createUserFixture({ role: UserRole.ADMIN, password: 'Secret123!' });
    const token = await loginAndGetToken(admin.email, 'Secret123!');
    const { documentId } = await createBuyerWithKycDoc();
    await testPrisma.document.update({
      where: { id: documentId },
      data: { rejectedAt: new Date(), rejectedReason: 'Flou' },
    });

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/kyc/${documentId}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
  });
});