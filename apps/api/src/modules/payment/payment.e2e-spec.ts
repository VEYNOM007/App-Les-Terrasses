import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, BadRequestException } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { CinetPayClient } from './cinetpay.client';
import { StripeClient } from './stripe.client';
import { ContractService } from '../contract/contract.service';
import { ReservationService } from '../reservation/reservation.service';
import { RedisModule } from '../../common/redis/redis.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { convertXofToEurCents, resolveXofToEurRate } from '../../common/payment/eur-conversion';
import {
  cleanupTestDatabase,
  createUserFixture,
  createProjectWithBlockAndUnits,
  createReservationWithSchedule,
  disconnectTestPrisma,
  extractCookieValue,
  getTestPrisma,
} from '../../common/testing/test-db.helper';

/**
 * Tests e2e HTTP — PaymentModule
 *
 * Routes testées :
 *   POST   /v1/payments/installments/:id/pay     (JWT requis)
 *   POST   /v1/payments/webhooks/cinetpay        (pas de JWT, vérification serveur-à-serveur)
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
    checkPaymentStatus: jest.Mock;
  };
  let stripeClient: {
    createCheckoutSession: jest.Mock;
    constructEvent: jest.Mock;
  };
  let reservationService: { confirmReservation: jest.Mock };
  let contractService: { generateBuyerContract: jest.Mock };

  beforeAll(async () => {
    cinetPayClient = {
      createPaymentSession: jest.fn().mockResolvedValue({
        paymentUrl: 'https://checkout.cinetpay.com/demo/tx-1',
        transactionId: 'tx-1',
      }),
      checkPaymentStatus: jest.fn().mockResolvedValue({
        code: '00',
        status: 'ACCEPTED',
        amount: '500000',
        currency: 'XOF',
      }),
    };
    stripeClient = {
      createCheckoutSession: jest.fn().mockResolvedValue({
        checkoutUrl: 'https://checkout.stripe.com/c/pay/cs-test-1',
        sessionId: 'cs-test-1',
      }),
      constructEvent: jest.fn().mockReturnValue(null),
    };
    reservationService = { confirmReservation: jest.fn().mockResolvedValue(undefined) };
    contractService = { generateBuyerContract: jest.fn().mockResolvedValue({ id: 'contract-001' }) };

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
        { provide: ContractService, useValue: contractService },
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(testPrisma)
      .overrideProvider(getQueueToken('reservation-expiration'))
      .useValue({ add: jest.fn() })
      .overrideProvider(getQueueToken('notification-dispatch'))
      .useValue({ add: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>({ rawBody: true });
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
    cinetPayClient.checkPaymentStatus.mockClear();
    stripeClient.createCheckoutSession.mockClear();
    stripeClient.constructEvent.mockClear();
    reservationService.confirmReservation.mockClear();
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

  it('POST /payments/installments/:id/pay sur l\'ACOMPTE avec KYC NON_SOUMIS -> 409 (gate identité)', async () => {
    const user = await createUserFixture({ email: 'pay4@test.tg', phone: '+22840404040', password: 'Secret123!' });
    // user.kycStatus reste NON_SOUMIS (défaut) : identité non soumise.
    const { units } = await createProjectWithBlockAndUnits(1);
    const { schedule } = await createReservationWithSchedule({
      userId: user.id,
      unitId: units[0].id,
    });
    // L'acompte (PAYE par défaut) est remis EN_ATTENTE pour le payer.
    const acompte = schedule.installments.find((i) => i.label === 'Acompte réservation')!;
    await testPrisma.paymentInstallment.update({
      where: { id: acompte.id },
      data: { status: 'EN_ATTENTE', provider: null, providerRef: null },
    });
    const token = await loginAndGetToken('pay4@test.tg', 'Secret123!');

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/payments/installments/${acompte.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'STRIPE' });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('identité');
    expect(stripeClient.createCheckoutSession).not.toHaveBeenCalled();
    expect(cinetPayClient.createPaymentSession).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────
  // POST /v1/payments/webhooks/cinetpay
  // ──────────────────────────────────────────────────

  it('POST /payments/webhooks/cinetpay : vérification ACCEPTED + montant cohérent -> 201 + installment PAYE', async () => {
    const user = await createUserFixture();
    const { units } = await createProjectWithBlockAndUnits(1);
    const { schedule } = await createReservationWithSchedule({
      userId: user.id,
      unitId: units[0].id,
    });
    const installment = schedule.installments.find((i) => i.label === 'Tranche fondations')!;
    // La transaction doit exister côté échéance (providerRef = cpm_trans_id)
    await testPrisma.paymentInstallment.update({
      where: { id: installment.id },
      data: { providerRef: 'cpm-e2e-123' },
    });
    cinetPayClient.checkPaymentStatus.mockResolvedValueOnce({
      code: '00',
      status: 'ACCEPTED',
      amount: String(installment.amount),
      currency: 'XOF',
    });

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/payments/webhooks/cinetpay`)
      .send({ cpm_trans_id: 'cpm-e2e-123' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ received: true });

    const updated = await testPrisma.paymentInstallment.findUniqueOrThrow({
      where: { id: installment.id },
    });
    expect(updated.status).toBe('PAYE');
    expect(updated.providerRef).toBe('cpm-e2e-123');
  });

  it('POST /payments/webhooks/cinetpay : désaccord webhook/vérification (REFUSED) -> 201 mais installment inchangé', async () => {
    const user = await createUserFixture();
    const { units } = await createProjectWithBlockAndUnits(1);
    const { schedule } = await createReservationWithSchedule({
      userId: user.id,
      unitId: units[0].id,
    });
    const installment = schedule.installments.find((i) => i.label === 'Tranche fondations')!;
    await testPrisma.paymentInstallment.update({
      where: { id: installment.id },
      data: { providerRef: 'cpm-e2e-refused' },
    });
    cinetPayClient.checkPaymentStatus.mockResolvedValueOnce({
      code: '627',
      status: 'REFUSED',
      amount: String(installment.amount),
      currency: 'XOF',
    });

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/payments/webhooks/cinetpay`)
      .send({ cpm_trans_id: 'cpm-e2e-refused' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ received: true });

    const updated = await testPrisma.paymentInstallment.findUniqueOrThrow({
      where: { id: installment.id },
    });
    expect(updated.status).toBe('EN_ATTENTE');
  });

  it('POST /payments/webhooks/cinetpay : désaccord de montant -> 201 mais jamais PAYE', async () => {
    const user = await createUserFixture();
    const { units } = await createProjectWithBlockAndUnits(1);
    const { schedule } = await createReservationWithSchedule({
      userId: user.id,
      unitId: units[0].id,
    });
    const installment = schedule.installments.find((i) => i.label === 'Tranche fondations')!;
    await testPrisma.paymentInstallment.update({
      where: { id: installment.id },
      data: { providerRef: 'cpm-e2e-amount' },
    });
    cinetPayClient.checkPaymentStatus.mockResolvedValueOnce({
      code: '00',
      status: 'ACCEPTED',
      amount: '999999',
      currency: 'XOF',
    });

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/payments/webhooks/cinetpay`)
      .send({ cpm_trans_id: 'cpm-e2e-amount' });

    expect(res.status).toBe(201);

    const updated = await testPrisma.paymentInstallment.findUniqueOrThrow({
      where: { id: installment.id },
    });
    expect(updated.status).toBe('EN_ATTENTE');
  });

  it('POST /payments/webhooks/cinetpay : transaction inconnue -> 201, aucun rappel de vérification', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/payments/webhooks/cinetpay`)
      .send({ cpm_trans_id: 'cpm-e2e-inconnu' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ received: true });
    expect(cinetPayClient.checkPaymentStatus).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────
  // POST /v1/payments/webhooks/stripe
  // ──────────────────────────────────────────────────

  it('POST /payments/webhooks/stripe avec event checkout.session.completed -> 201 + installment PAYE', async () => {
    const user = await createUserFixture();
    const { units } = await createProjectWithBlockAndUnits(1);
    const { schedule } = await createReservationWithSchedule({
      userId: user.id,
      unitId: units[0].id,
    });
    const installment = schedule.installments.find((i) => i.label === 'Tranche fondations')!;

    // constructEvent retourne l'event parse -> signature valide, montant conforme
    stripeClient.constructEvent.mockReturnValueOnce({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          payment_intent: 'pi_456',
          amount_total: convertXofToEurCents(Number(installment.amount), resolveXofToEurRate()),
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

  it('POST /payments/webhooks/stripe : signature invalide -> 400, échéance jamais PAYE', async () => {
    const user = await createUserFixture();
    const { units } = await createProjectWithBlockAndUnits(1);
    const { schedule } = await createReservationWithSchedule({
      userId: user.id,
      unitId: units[0].id,
    });
    const installment = schedule.installments.find((i) => i.label === 'Tranche fondations')!;

    // Le client réel (constructEvent) lève BadRequestException sur une
    // signature invalide — le webhook est rejeté avant tout traitement.
    stripeClient.constructEvent.mockImplementationOnce(() => {
      throw new BadRequestException('Signature Stripe invalide.');
    });

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/payments/webhooks/stripe`)
      .set('stripe-signature', 'stripe-sig-forgee')
      .send({ type: 'checkout.session.completed', data: { object: {} } });

    expect(res.status).toBe(400);

    const updated = await testPrisma.paymentInstallment.findUniqueOrThrow({
      where: { id: installment.id },
    });
    expect(updated.status).toBe('EN_ATTENTE');
  });

  it('POST /payments/webhooks/stripe : désaccord de montant -> 201 mais jamais PAYE', async () => {
    const user = await createUserFixture();
    const { units } = await createProjectWithBlockAndUnits(1);
    const { schedule } = await createReservationWithSchedule({
      userId: user.id,
      unitId: units[0].id,
    });
    const installment = schedule.installments.find((i) => i.label === 'Tranche fondations')!;

    stripeClient.constructEvent.mockReturnValueOnce({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_999',
          payment_intent: 'pi_999',
          amount_total: 1,
          metadata: { installmentId: installment.id },
        },
      },
    });

    const res = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/payments/webhooks/stripe`)
      .set('stripe-signature', 'sig')
      .send({ type: 'checkout.session.completed', data: { object: {} } });

    expect(res.status).toBe(201);

    const updated = await testPrisma.paymentInstallment.findUniqueOrThrow({
      where: { id: installment.id },
    });
    expect(updated.status).toBe('EN_ATTENTE');
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
