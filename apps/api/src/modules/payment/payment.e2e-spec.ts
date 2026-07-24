import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { CinetPayClient } from './cinetpay.client';
import { StripeClient } from './stripe.client';
import { ReservationService } from '../reservation/reservation.service';
import { RedisModule } from '../../common/redis/redis.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import {
  cleanupTestDatabase,
  createUserFixture,
  createProjectWithBlockAndUnits,
  createReservationWithSchedule,
  disconnectTestPrisma,
  getTestPrisma,
} from '../../common/testing/test-db.helper';

/**
 * Tests e2e HTTP — PaymentModule
 *
 * Routes testées :
 *   POST   /v1/payments/installments/:id/pay     (JWT requis)
 *   POST   /v1/payments/webhooks/cinetpay        (pas de JWT, signature)
 *   POST   /v1/payments/webhooks/stripe          (pas de JWT, signature)
 *
 * Overrides :
 *   - PrismaService -> singleton DATABASE_URL_TEST
 *   - ReservationService -> mock (evite le cycle launch/recalcul hors scope)
 *   - NotificationService -> mock (pas de dispatch BullMQ)
 *   - CinetPayClient / StripeClient -> mocks (pas d'appel HTTP reel)
 *   - Queues BullMQ -> mocks
 */

const API_PREFIX = 'v1';

describe('PaymentModule — e2e HTTP (supertest)', () => {
  let app: INestApplication;
  const testPrisma = getTestPrisma();

  let cinetPayClient: {
    createPaymentSession: jest.Mock;
    verifySignature: jest.Mock;
  };
  let stripeClient: {
    createCheckoutSession: jest.Mock;
    constructEvent: jest.Mock;
  };
  let reservationService: { confirmReservation: jest.Mock };

  beforeAll(async () => {
    cinetPayClient = {
      createPaymentSession: jest.fn().mockResolvedValue({
        paymentUrl: 'https://checkout.cinetpay.com/demo/tx-1',
        transactionId: 'tx-1',
      }),
      verifySignature: jest.fn().mockReturnValue(true),
    };
    stripeClient = {
      createCheckoutSession: jest.fn().mockResolvedValue({
        checkoutUrl: 'https://checkout.stripe.com/c/pay/cs-test-1',
        sessionId: 'cs-test-1',
      }),
      constructEvent: jest.fn().mockReturnValue(null),
    };
    reservationService = { confirmReservation: jest.fn().mockResolvedValue(undefined) };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        BullModule.forRoot({
          connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
        }),
        BullModule.registerQueue({ name: 'reservation-expiration' }),
        BullModule.registerQueue({ name: 'notification-dispatch' }),
        PrismaModule,
        RedisModule,
        AuthModule,
      ],
      controllers: [PaymentController],
      providers: [
        PaymentService,
        { provide: CinetPayClient, useValue: cinetPayClient },
        { provide: StripeClient, useValue: stripeClient },
        { provide: ReservationService, useValue: reservationService },
        { provide: NotificationService, useValue: { notifyUser: jest.fn() } },
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(testPrisma)
      .overrideProvider(getQueueToken('reservation-expiration'))
      .useValue({ add: jest.fn() })
      .overrideProvider(getQueueToken('notification-dispatch'))
      .useValue({ add: jest.fn() })
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
    cinetPayClient.createPaymentSession.mockClear();
    cinetPayClient.verifySignature.mockClear();
    stripeClient.createCheckoutSession.mockClear();
    stripeClient.constructEvent.mockClear();
    reservationService.confirmReservation.mockClear();
  });

  async function loginAndGetToken(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/login`)
      .send({ email, password });
    return res.body.accessToken;
  }

  // ──────────────────────────────────────────────────
  // POST /v1/payments/installments/:id/pay
  // ──────────────────────────────────────────────────

  it('POST /payments/installments/:id/pay sans JWT -> 401', async () => {
    const user = await createUserFixture();
    const { units } = await createProjectWithBlockAndUnits(1);
    const { schedule } = await createReservationWithSchedule({
      userId: user.id,
      unitId: units[0].id,
    });
    const installment = schedule.installments.find((i) => i.label === 'Tranche fondations')!;

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/payments/installments/${installment.id}/pay`)
      .send({ provider: 'CINETPAY' });

    expect(res.status).toBe(401);
  });

  it('POST /payments/installments/:id/pay CINETPAY avec JWT -> 200 + paymentUrl', async () => {
    await createUserFixture({ email: 'pay1@test.tg', phone: '+22810101010', password: 'Secret123!' });
    const { units } = await createProjectWithBlockAndUnits(1);
    const { schedule } = await createReservationWithSchedule({
      userId: (await testPrisma.user.findUniqueOrThrow({ where: { email: 'pay1@test.tg' } })).id,
      unitId: units[0].id,
    });
    const token = await loginAndGetToken('pay1@test.tg', 'Secret123!');
    const installment = schedule.installments.find((i) => i.label === 'Tranche fondations')!;

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/payments/installments/${installment.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'CINETPAY' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('paymentUrl');
    expect(res.body).toHaveProperty('transactionId');
    expect(res.body.provider).toBe('CINETPAY');
    expect(cinetPayClient.createPaymentSession).toHaveBeenCalledTimes(1);
  });

  it('POST /payments/installments/:id/pay STRIPE avec JWT -> 201 + checkoutUrl + sessionId', async () => {
    await createUserFixture({ email: 'pay2@test.tg', phone: '+22820202020', password: 'Secret123!' });
    const { units } = await createProjectWithBlockAndUnits(1);
    const { schedule } = await createReservationWithSchedule({
      userId: (await testPrisma.user.findUniqueOrThrow({ where: { email: 'pay2@test.tg' } })).id,
      unitId: units[0].id,
    });
    const token = await loginAndGetToken('pay2@test.tg', 'Secret123!');
    const installment = schedule.installments.find((i) => i.label === 'Tranche fondations')!;

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/payments/installments/${installment.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'STRIPE' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('paymentUrl');
    expect(res.body).toHaveProperty('sessionId');
    expect(res.body.provider).toBe('STRIPE');
    expect(stripeClient.createCheckoutSession).toHaveBeenCalledTimes(1);
  });

  it('POST /payments/installments/:id/pay sur échéance déjà payée -> 400', async () => {
    await createUserFixture({ email: 'pay3@test.tg', phone: '+22830303030', password: 'Secret123!' });
    const { units } = await createProjectWithBlockAndUnits(1);
    const { schedule } = await createReservationWithSchedule({
      userId: (await testPrisma.user.findUniqueOrThrow({ where: { email: 'pay3@test.tg' } })).id,
      unitId: units[0].id,
    });
    const token = await loginAndGetToken('pay3@test.tg', 'Secret123!');
    // L'acompte est déjà PAYE dans le fixture
    const acompte = schedule.installments.find((i) => i.label === 'Acompte réservation')!;

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/payments/installments/${acompte.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'CINETPAY' });

    expect(res.status).toBe(400);
  });

  // ──────────────────────────────────────────────────
  // POST /v1/payments/webhooks/cinetpay
  // ──────────────────────────────────────────────────

  it('POST /payments/webhooks/cinetpay avec payload valide -> 200 + installment PAYE', async () => {
    const user = await createUserFixture();
    const { units } = await createProjectWithBlockAndUnits(1);
    const { schedule } = await createReservationWithSchedule({
      userId: user.id,
      unitId: units[0].id,
    });
    const installment = schedule.installments.find((i) => i.label === 'Tranche fondations')!;
    cinetPayClient.verifySignature.mockReturnValueOnce(true);

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/payments/webhooks/cinetpay`)
      .set('x-cinetpay-signature', 'valid-signature')
      .send({
        cpm_trans_id: 'cpm-123',
        cpm_result: '00',
        metadata: { installmentId: installment.id },
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ received: true });

    const updated = await testPrisma.paymentInstallment.findUniqueOrThrow({
      where: { id: installment.id },
    });
    expect(updated.status).toBe('PAYE');
  });

  it('POST /payments/webhooks/cinetpay en dev (NODE_ENV != production) traite meme si signature invalide', async () => {
    const user = await createUserFixture();
    const { units } = await createProjectWithBlockAndUnits(1);
    const { schedule } = await createReservationWithSchedule({
      userId: user.id,
      unitId: units[0].id,
    });
    const installment = schedule.installments.find((i) => i.label === 'Tranche fondations')!;

    // verifySignature retourne false -> signature invalide.
    // Comportement dev (documenté dans payment.service.ts) : on continue
    // quand même — le check strict n'est actif qu'en production.
    cinetPayClient.verifySignature.mockReturnValueOnce(false);

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/payments/webhooks/cinetpay`)
      .send({
        cpm_trans_id: 'cpm-123',
        cpm_result: '00',
        metadata: { installmentId: installment.id },
      });

    expect(res.status).toBe(201);

    // En dev, le paiement est traité malgré la signature invalide.
    // Comportement parallèle à Stripe (constructEvent retourne null en
    // dev = pas de vérification, on accepte le body brut).
    const updated = await testPrisma.paymentInstallment.findUniqueOrThrow({
      where: { id: installment.id },
    });
    expect(updated.status).toBe('PAYE');
  });

  // ──────────────────────────────────────────────────
  // POST /v1/payments/webhooks/stripe
  // ──────────────────────────────────────────────────

  it('POST /payments/webhooks/stripe avec event checkout.session.completed -> 200 + installment PAYE', async () => {
    const user = await createUserFixture();
    const { units } = await createProjectWithBlockAndUnits(1);
    const { schedule } = await createReservationWithSchedule({
      userId: user.id,
      unitId: units[0].id,
    });
    const installment = schedule.installments.find((i) => i.label === 'Tranche fondations')!;

    // constructEvent retourne l'event parse -> signature valide
    stripeClient.constructEvent.mockReturnValueOnce({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          payment_intent: 'pi_456',
          metadata: { installmentId: installment.id },
        },
      },
    });

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/payments/webhooks/stripe`)
      .set('stripe-signature', 'stripe-sig-valid')
      .send({ type: 'checkout.session.completed', data: { object: {} } });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ received: true });

    const updated = await testPrisma.paymentInstallment.findUniqueOrThrow({
      where: { id: installment.id },
    });
    expect(updated.status).toBe('PAYE');
    expect(updated.providerRef).toBe('pi_456');
  });

  it('POST /payments/webhooks/stripe avec event non pertinent -> 200, installment inchangé', async () => {
    const user = await createUserFixture();
    const { units } = await createProjectWithBlockAndUnits(1);
    const { schedule } = await createReservationWithSchedule({
      userId: user.id,
      unitId: units[0].id,
    });
    const installment = schedule.installments.find((i) => i.label === 'Tranche fondations')!;

    stripeClient.constructEvent.mockReturnValueOnce({
      type: 'payment_intent.payment_failed',
      data: { object: {} },
    });

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/payments/webhooks/stripe`)
      .set('stripe-signature', 'sig')
      .send({ type: 'payment_intent.payment_failed' });

    expect(res.status).toBe(201);

    const updated = await testPrisma.paymentInstallment.findUniqueOrThrow({
      where: { id: installment.id },
    });
    expect(updated.status).toBe('EN_ATTENTE');
  });
});
