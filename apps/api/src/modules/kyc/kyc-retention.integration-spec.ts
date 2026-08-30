import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DocumentType, KycStatus, UserRole } from '@prisma/client';
import { KycModule } from './kyc.module';
import { KycService } from './kyc.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageModule } from '../../common/storage/storage.module';
import { StorageService } from '../../common/storage/storage.service';
import { NotificationModule } from '../notification/notification.module';
import { NotificationService } from '../notification/notification.service';
import { KYC_REJECTED_RETENTION_MS } from './kyc-retention.constants';
import {
  cleanupTestDatabase,
  createUserFixture,
  disconnectTestPrisma,
  getTestPrisma,
} from '../../common/testing/test-db.helper';

/**
 * Tests d'INTEGRATION du mécanisme de purge KYC — queue BullMQ REELLE
 * (Redis) + Worker REEEL (KycDocumentRetentionProcessor) + base de test.
 *
 * Complète la spec unitaire (contrat d'appel mocké) et l'e2e HTTP (guards)
 * là où la queue est volontairement mockée : ici, aucun mock de queue.
 *
 * Couverture :
 *  1. Anti-double-planification : un `documentId` ne peut produire qu'UN
 *     seul job `retain-document` (jobId = documentId) — vérifié sur Redis
 *     réel, re-planification volontaire comprise.
 *  2. Cycle complet : job planifié avec délai court -> Worker réel ->
 *     KycService.purgeRejectedDocument -> objet B2 supprimé + ligne base
 *     réellement supprimée, job passé en `completed`.
 *
 * Le worker est agnostique au délai (source de vérité = Document.rejectedAt) :
 * le cycle complet est donc exercé avec un délai court (marge généreuse
 * pour limiter la flakiness CI), la purge à 15 jours restant une constante
 * de planification verrouillée par la spec unitaire.
 */

const RETENTION_QUEUE = 'kyc-document-retention';
const RETENTION_QUEUE_TOKEN = getQueueToken(RETENTION_QUEUE);
const SHORT_PURGE_DELAY_MS = 300;
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
  throw new Error(`waitFor: condition non atteinte après ${timeoutMs} ms`);
}

describe('Retention KYC - intégration queue réelle (BullMQ + Redis)', () => {
  let app: INestApplication;
  let service: KycService;
  let queue: Queue;

  const storage = {
    deleteObject: jest.fn(),
    putObject: jest.fn(),
    getSignedUrl: jest.fn(),
  };
  const notifyUser = jest.fn().mockResolvedValue({ id: 'notif-int' });
  const testPrisma = getTestPrisma();

  async function seedKycOwner() {
    const user = await createUserFixture({ role: UserRole.ACHETEUR });
    await testPrisma.user.update({
      where: { id: user.id },
      data: { kycStatus: KycStatus.EN_ATTENTE },
    });
    return user;
  }

  async function seedDocument(overrides: { rejected?: boolean; fileUrl?: string } = {}) {
    const user = await seedKycOwner();
    const doc = await testPrisma.document.create({
      data: {
        type: DocumentType.PIECE_IDENTITE,
        name: 'Pièce d\'identité',
        fileUrl: overrides.fileUrl ?? 'kyc/integration-kyc.png',
        kycOwnerId: user.id,
        rejectedAt: overrides.rejected ? new Date() : null,
        rejectedReason: overrides.rejected ? 'Document test pour purge' : null,
      },
    });
    return { userId: user.id, doc };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        BullModule.forRoot({
          connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
        }),
        KycModule,
        PrismaModule,
        StorageModule,
        NotificationModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(testPrisma)
      .overrideProvider(StorageService)
      .useValue(storage)
      .overrideProvider(NotificationService)
      .useValue({ notifyUser })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    service = app.get(KycService);
    queue = app.get<Queue>(RETENTION_QUEUE_TOKEN);

    // Repart d'une file vierge (un run tué laisse idéalement un job delayed 15 j).
    await queue.obliterate({ force: true });
  });

  afterEach(async () => {
    await queue.obliterate({ force: true });
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

  it('anti-double-planification : au plus un job de purge par documentId (jobId = documentId)', async () => {
    const { doc, userId } = await seedDocument();

    await service.reject(doc.id, 'Document flou : merci de ressoumettre une pièce nette.');

    // 1) La planification réelle (service -> queue BullMQ) est POSEE avec jobId = documentId.
    const scheduled = await queue.getJob(doc.id);
    expect(scheduled).not.toBeNull();
    expect(scheduled?.id).toBe(doc.id);
    expect(scheduled?.name).toBe('retain-document');
    expect(scheduled?.data).toEqual({ documentId: doc.id });

    // 2) Re-planification volontaire du MÊME job (simule un retry en double).
    //    BullMQ (sonde) : le second add retourne le job EXISTANT — aucun doublon.
    const duplicate = await queue.add(
      'retain-document',
      { documentId: doc.id },
      { delay: KYC_REJECTED_RETENTION_MS, jobId: doc.id },
    );
    expect(duplicate?.id).toBe(doc.id);

    const pending = await queue.getJobs(['delayed', 'waiting', 'active']);
    const matches = pending.filter((j) => j.id === doc.id && j.name === 'retain-document');
    expect(matches).toHaveLength(1);

    // 3) Contrepartie traitement : user REJETE + notification avec le motif.
    const userRow = await testPrisma.user.findUnique({ where: { id: userId } });
    expect(userRow?.kycStatus).toBe(KycStatus.REJETE);
    expect(notifyUser).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        body: expect.stringContaining('Document flou : merci de ressoumettre une pièce nette.'),
      }),
    );
  });

  it('cycle complet : worker réel -> purgeRejectedDocument -> objet B2 supprimé + ligne base supprimée', async () => {
    const { doc } = await seedDocument({ rejected: true, fileUrl: 'kyc/integration-purge.png' });

    await queue.add(
      'retain-document',
      { documentId: doc.id },
      { delay: SHORT_PURGE_DELAY_MS, jobId: doc.id },
    );

    // Le Worker réel (KycDocumentRetentionProcessor) exécute le job ~300 ms plus tard.
    await waitFor(async () => {
      const row = await testPrisma.document.findUnique({ where: { id: doc.id } });
      return row === null;
    });

    expect(storage.deleteObject).toHaveBeenCalledWith('kyc/integration-purge.png');
    // Le worker marque le job `completed` un instant après la purge : on attend ce passage.
    await waitFor(async () => (await queue.getJobState(doc.id)) === 'completed');
  });
});