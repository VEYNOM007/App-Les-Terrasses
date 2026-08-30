import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { BullModule } from '@nestjs/bullmq';
import { DocumentType, KycStatus, ReservationStatus, UserRole } from '@prisma/client';
import { AuthModule } from '../auth/auth.module';
import { ContractModule } from './contract.module';
import { ContractPdfService } from './contract-pdf.service';
import { NotificationModule } from '../notification/notification.module';
import { NotificationService } from '../notification/notification.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import {
  cleanupTestDatabase,
  createProjectWithBlockAndUnits,
  createUserFixture,
  disconnectTestPrisma,
  extractCookieValue,
  getTestPrisma,
} from '../../common/testing/test-db.helper';

/**
 * Tests e2e HTTP — GATE KYC sur la signature de contrat (POST /v1/contracts/:id/sign).
 *
 * Branche PROPRIETAIRE sur un contrat de réservation : la signature est
 * refusée (409) tant que la vérification d'identité de l'acheteur n'est
 * pas VALIDE, puis autorisée une fois validée. Vérifie le wiring complet :
 * guard JWT réel (login -> Bearer), FileInterceptor multipart réel,
 * ValidationPipe, chaîne service -> base réelle. Storage B2/PDF mockés.
 */

const VALID_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const API_PREFIX = 'v1';

describe('ContractService signContract — gate KYC (e2e HTTP)', () => {
  let app: INestApplication;
  const testPrisma = getTestPrisma();
  const storage = { putObject: jest.fn(), getObject: jest.fn(), getSignedUrl: jest.fn(), deleteObject: jest.fn() };
  const notifyUser = jest.fn();
  const pdf = { generate: jest.fn(), sign: jest.fn() };

  async function loginAndGetToken(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/login`)
      .send({ email, password });
    const token = extractCookieValue(res, 'access_token');
    if (!token) throw new Error('access_token absent du Set-Cookie après login');
    return token;
  }

  async function seedBuyerContract(kycStatus: KycStatus) {
    const user = await createUserFixture({
      email: `gate-${kycStatus.toLowerCase()}-${Date.now()}@test.tg`,
      role: UserRole.ACHETEUR,
      password: 'Secret123!',
    });
    await testPrisma.user.update({ where: { id: user.id }, data: { kycStatus } });

    const { units } = await createProjectWithBlockAndUnits(1);
    const reservation = await testPrisma.reservation.create({
      data: {
        unitId: units[0].id,
        userId: user.id,
        status: ReservationStatus.CONFIRMEE,
        lockExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });
    const document = await testPrisma.document.create({
      data: {
        type: DocumentType.CONTRAT,
        name: 'Contrat de vente - e2e gate',
        fileUrl: 'contracts/e2e-gate.pdf',
        reservationId: reservation.id,
      },
    });
    return { user, document };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        BullModule.forRoot({
          connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
        }),
        PrismaModule,
        AuthModule,
        ContractModule,
        NotificationModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(testPrisma)
      .overrideProvider(StorageService)
      .useValue(storage)
      .overrideProvider(ContractPdfService)
      .useValue(pdf)
      .overrideProvider(NotificationService)
      .useValue({ notifyUser })
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
    storage.putObject.mockClear();
    notifyUser.mockClear();
  });

  it('PROPRIETAIRE avec KYC EN_ATTENTE -> 409, aucune signature déposée sur B2 ni en base', async () => {
    const { user, document } = await seedBuyerContract(KycStatus.EN_ATTENTE);
    const token = await loginAndGetToken(user.email, 'Secret123!');

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/contracts/${document.id}/sign`)
      .set('Authorization', `Bearer ${token}`)
      .attach('signature', VALID_PNG, { filename: 'sig.png', contentType: 'image/png' });

    expect(res.status).toBe(409);
    expect(storage.putObject).not.toHaveBeenCalled();
    const signatures = await testPrisma.contractSignature.findMany({ where: { documentId: document.id } });
    expect(signatures).toHaveLength(0);
  });

  it('PROPRIETAIRE avec KYC REJETE -> 409 (motif annexe : l\'acheteur doit ressoumettre sa pièce)', async () => {
    const { user, document } = await seedBuyerContract(KycStatus.REJETE);
    const token = await loginAndGetToken(user.email, 'Secret123!');

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/contracts/${document.id}/sign`)
      .set('Authorization', `Bearer ${token}`)
      .attach('signature', VALID_PNG, { filename: 'sig.png', contentType: 'image/png' });

    expect(res.status).toBe(409);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('PROPRIETAIRE avec KYC VALIDE -> 201, signature PROPRIETAIRE persistée en base', async () => {
    const { user, document } = await seedBuyerContract(KycStatus.VALIDE);
    const token = await loginAndGetToken(user.email, 'Secret123!');

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/contracts/${document.id}/sign`)
      .set('Authorization', `Bearer ${token}`)
      .attach('signature', VALID_PNG, { filename: 'sig.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(storage.putObject).toHaveBeenCalledTimes(1);
    const signatures = await testPrisma.contractSignature.findMany({ where: { documentId: document.id } });
    expect(signatures).toHaveLength(1);
    expect(signatures[0]).toMatchObject({
      signerType: 'PROPRIETAIRE',
      signerUserId: user.id,
    });
  });
});