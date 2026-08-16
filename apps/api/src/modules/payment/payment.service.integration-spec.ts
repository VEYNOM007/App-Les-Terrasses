import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PaymentService, CinetPayWebhookPayload } from './payment.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ReservationService } from '../reservation/reservation.service';
import { NotificationService } from '../notification/notification.service';
import { CinetPayClient } from './cinetpay.client';
import { StripeClient } from './stripe.client';
import {
  cleanupTestDatabase,
  createUserFixture,
  createProjectWithBlockAndUnits,
  createReservationWithSchedule,
  disconnectTestPrisma,
  getTestPrisma,
} from '../../common/testing/test-db.helper';

/**
 * Tests d'integration — PaymentService (vraie DB PostgreSQL)
 *
 * Couvre les scenarios critiques (R6 CLAUDE.md — argent) que les tests
 * unitaires ne peuvent pas valider seuls :
 *   - generateSchedule : cree bien 5 installments avec bons montants %
 *   - initiatePayment : update installment.provider en DB
 *   - markInstallmentPaid : transition PAYE + confirmReservation +
 *     notification dispatchée, avec idempotence sur double appel
 *   - handleCinetPayWebhook / handleStripeWebhook : signature + flow
 *
 * CinetPayClient / StripeClient / NotificationService mockés (pas
 * d'appels HTTP reels), mais la DB est reelle.
 */

describe('PaymentService — integration (vraie DB)', () => {
  let service: PaymentService;
  let module: TestingModule;
  const testPrisma = getTestPrisma();

  let reservationService: { confirmReservation: jest.Mock };
  let notificationService: { notifyUser: jest.Mock };
  let cinetPayClient: {
    createPaymentSession: jest.Mock;
    checkPaymentStatus: jest.Mock;
  };
  let stripeClient: {
    createCheckoutSession: jest.Mock;
    constructEvent: jest.Mock;
  };

  beforeAll(async () => {
    reservationService = { confirmReservation: jest.fn().mockResolvedValue(undefined) };
    notificationService = { notifyUser: jest.fn().mockResolvedValue(undefined) };
    cinetPayClient = {
      createPaymentSession: jest.fn().mockResolvedValue({
        paymentUrl: 'https://checkout.cinetpay.com/demo/tx-1',
        transactionId: 'tx-1',
        token: 'demo-token',
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

    module = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: testPrisma },
        { provide: ReservationService, useValue: reservationService },
        { provide: NotificationService, useValue: notificationService },
        { provide: CinetPayClient, useValue: cinetPayClient },
        { provide: StripeClient, useValue: stripeClient },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  afterAll(async () => {
    await module.close();
    await disconnectTestPrisma();
  });

  beforeEach(async () => {
    await cleanupTestDatabase();
    reservationService.confirmReservation.mockClear();
    notificationService.notifyUser.mockClear();
    cinetPayClient.createPaymentSession.mockClear();
    cinetPayClient.checkPaymentStatus.mockClear();
    stripeClient.createCheckoutSession.mockClear();
    stripeClient.constructEvent.mockClear();
  });

  // ──────────────────────────────────────────────────
  // generateSchedule
  // ──────────────────────────────────────────────────

  describe('generateSchedule', () => {
    it('cree 5 installments (acompte deja PAYE + 4 EN_ATTENTE) avec montants coherents', async () => {
      const user = await createUserFixture();
      const { units } = await createProjectWithBlockAndUnits(1);
      // Cree une reservation simple sans schedule
      const reservation = await testPrisma.reservation.create({
        data: {
          unitId: units[0].id,
          userId: user.id,
          status: 'EN_ATTENTE',
          lockExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      });

      const schedule = await service.generateSchedule(reservation.id);

      expect(schedule.installments).toHaveLength(5);
      const labels = schedule.installments.map((i) => i.label);
      expect(labels).toContain('Acompte réservation');
      expect(labels).toContain('Solde livraison');

      // Somme des montants ~= prix total (10 + 20 + 30 + 25 + 15 = 100%)
      const total = schedule.installments.reduce(
        (sum, i) => sum + Number(i.amount),
        0,
      );
      expect(total).toBeCloseTo(Number(units[0].price), 2);
    });

    it('leve NotFoundException si la reservation n\'existe pas', async () => {
      await expect(service.generateSchedule('non-existent')).rejects.toThrow();
    });
  });

  // ──────────────────────────────────────────────────
  // initiatePayment
  // ──────────────────────────────────────────────────

  describe('initiatePayment', () => {
    it('initie un paiement CINETPAY et update installment.provider en DB', async () => {
      const user = await createUserFixture();
      const { units } = await createProjectWithBlockAndUnits(1);
      const { schedule } = await createReservationWithSchedule({
        userId: user.id,
        unitId: units[0].id,
      });
      // Cible la 2e échéance (fondations, EN_ATTENTE)
      const installment = schedule.installments.find((i) => i.label === 'Tranche fondations')!;

      const result = await service.initiatePayment(installment.id, 'CINETPAY', user.id);

      expect(result.provider).toBe('CINETPAY');
      expect(result.paymentUrl).toMatch(/cinetpay/);
      expect(result.transactionId).toBeDefined();

      const updated = await testPrisma.paymentInstallment.findUniqueOrThrow({
        where: { id: installment.id },
      });
      expect(updated.provider).toBe('CINETPAY');
      expect(updated.providerRef).toBe(result.transactionId);
    });

    it('initie un paiement STRIPE et update installment.provider en DB', async () => {
      const user = await createUserFixture();
      const { units } = await createProjectWithBlockAndUnits(1);
      const { schedule } = await createReservationWithSchedule({
        userId: user.id,
        unitId: units[0].id,
      });
      const installment = schedule.installments.find((i) => i.label === 'Tranche fondations')!;

      const result = await service.initiatePayment(installment.id, 'STRIPE', user.id);

      expect(result.provider).toBe('STRIPE');
      expect(result.paymentUrl).toMatch(/stripe/);
      expect(result.sessionId).toBeDefined();

      const updated = await testPrisma.paymentInstallment.findUniqueOrThrow({
        where: { id: installment.id },
      });
      expect(updated.provider).toBe('STRIPE');
    });

    it('leve BadRequestException si l\'échéance n\'appartient pas au user', async () => {
      const user = await createUserFixture();
      const intruder = await createUserFixture({ email: 'intruder@test.tg', phone: '+22877777777' });
      const { units } = await createProjectWithBlockAndUnits(1);
      const { schedule } = await createReservationWithSchedule({
        userId: user.id,
        unitId: units[0].id,
      });
      const installment = schedule.installments.find((i) => i.label === 'Tranche fondations')!;

      await expect(service.initiatePayment(installment.id, 'CINETPAY', intruder.id)).rejects.toThrow(
        BadRequestException,
      );

      // Aucun appel provider
      expect(cinetPayClient.createPaymentSession).not.toHaveBeenCalled();
    });

    it('leve BadRequestException si l\'échéance est deja PAYE', async () => {
      const user = await createUserFixture();
      const { units } = await createProjectWithBlockAndUnits(1);
      const { schedule } = await createReservationWithSchedule({
        userId: user.id,
        unitId: units[0].id,
      });
      // Acompte est PAYE dans le fixture
      const acompte = schedule.installments.find((i) => i.label === 'Acompte réservation')!;

      await expect(service.initiatePayment(acompte.id, 'CINETPAY', user.id)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ──────────────────────────────────────────────────
  // markInstallmentPaid — idempotence
  // ──────────────────────────────────────────────────

  describe('markInstallmentPaid', () => {
    it('marque l\'échéance PAYE, dispatch la notification, sans confirmReservation (pas l\'acompte)', async () => {
      const user = await createUserFixture();
      const { units } = await createProjectWithBlockAndUnits(1);
      const { schedule } = await createReservationWithSchedule({
        userId: user.id,
        unitId: units[0].id,
      });
      const installment = schedule.installments.find((i) => i.label === 'Tranche fondations')!;

      await service.markInstallmentPaid(installment.id, 'CINETPAY', 'cpm-tx-001');

      const updated = await testPrisma.paymentInstallment.findUniqueOrThrow({
        where: { id: installment.id },
      });
      expect(updated.status).toBe('PAYE');
      expect(updated.provider).toBe('CINETPAY');
      expect(updated.providerRef).toBe('cpm-tx-001');
      expect(updated.paidAt).not.toBeNull();

      // Notification dispatchée
      expect(notificationService.notifyUser).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({ title: 'Paiement reçu' }),
      );

      // PAS confirmReservation parce que c'est pas l'acompte
      expect(reservationService.confirmReservation).not.toHaveBeenCalled();
    });

    it('declenche confirmReservation quand l\'acompte est payé', async () => {
      // Pour tester ce cas, il nous faut une réservation EN_ATTENTE avec
      // acompte EN_ATTENTE (pas deja PAYE comme dans le fixture standard)
      const user = await createUserFixture();
      const { units } = await createProjectWithBlockAndUnits(1);

      const reservation = await testPrisma.reservation.create({
        data: {
          unitId: units[0].id,
          userId: user.id,
          status: 'EN_ATTENTE',
          lockExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      });
      const schedule = await testPrisma.paymentSchedule.create({
        data: {
          reservationId: reservation.id,
          totalAmount: 24_000_000,
          currency: 'XOF',
          installments: {
            create: [
              {
                label: 'Acompte réservation',
                amount: 2_400_000,
                dueDate: new Date(),
                status: 'EN_ATTENTE',
              },
            ],
          },
        },
        include: { installments: true },
      });

      const acompte = schedule.installments[0];
      await service.markInstallmentPaid(acompte.id, 'CINETPAY', 'cpm-acompte');

      expect(reservationService.confirmReservation).toHaveBeenCalledWith(reservation.id);
    });

    it('est idempotent : 2e appel est ignoré sans erreur ni double notification', async () => {
      const user = await createUserFixture();
      const { units } = await createProjectWithBlockAndUnits(1);
      const { schedule } = await createReservationWithSchedule({
        userId: user.id,
        unitId: units[0].id,
      });
      const installment = schedule.installments.find((i) => i.label === 'Tranche fondations')!;

      await service.markInstallmentPaid(installment.id, 'CINETPAY', 'cpm-tx-001');
      expect(notificationService.notifyUser).toHaveBeenCalledTimes(1);

      // 2e appel avec le meme providerRef -> doit etre no-op
      await service.markInstallmentPaid(installment.id, 'CINETPAY', 'cpm-tx-001');
      expect(notificationService.notifyUser).toHaveBeenCalledTimes(1); // toujours 1
    });

    it('est silencieux si l\'installment est introuvable', async () => {
      // Ne doit pas lever — un webhook pour une vieille échéance supprimée
      // ne doit pas crasher le processor BullMQ
      await expect(
        service.markInstallmentPaid('non-existent-id', 'CINETPAY', 'cpm-x'),
      ).resolves.toBeUndefined();

      expect(notificationService.notifyUser).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────
  // handleCinetPayWebhook
  // ──────────────────────────────────────────────────

  describe('handleCinetPayWebhook', () => {
    it('marque PAYE si la vérification serveur-à-serveur confirme ACCEPTED + montant cohérent', async () => {
      const user = await createUserFixture();
      const { units } = await createProjectWithBlockAndUnits(1);
      const { schedule } = await createReservationWithSchedule({
        userId: user.id,
        unitId: units[0].id,
      });
      const installment = schedule.installments.find((i) => i.label === 'Tranche fondations')!;

      // L'initiation stocke providerRef (TX-...) : c'est cette référence que le
      // webhook doit rapporter (cpm_trans_id) pour retrouver l'échéance.
      const result = await service.initiatePayment(installment.id, 'CINETPAY', user.id);

      cinetPayClient.checkPaymentStatus.mockResolvedValueOnce({
        code: '00',
        status: 'ACCEPTED',
        amount: String(installment.amount),
        currency: 'XOF',
      });

      await service.handleCinetPayWebhook({ cpm_trans_id: result.transactionId });

      const updated = await testPrisma.paymentInstallment.findUniqueOrThrow({
        where: { id: installment.id },
      });
      expect(updated.status).toBe('PAYE');
      expect(updated.providerRef).toBe(result.transactionId);
    });

    it('désaccord de montant : refuse même si CinetPay confirme ACCEPTED avec un montant != échéance', async () => {
      const user = await createUserFixture();
      const { units } = await createProjectWithBlockAndUnits(1);
      const { schedule } = await createReservationWithSchedule({
        userId: user.id,
        unitId: units[0].id,
      });
      const installment = schedule.installments.find((i) => i.label === 'Tranche fondations')!;

      const result = await service.initiatePayment(installment.id, 'CINETPAY', user.id);

      cinetPayClient.checkPaymentStatus.mockResolvedValueOnce({
        code: '00',
        status: 'ACCEPTED',
        amount: '999999',
        currency: 'XOF',
      });

      await service.handleCinetPayWebhook({ cpm_trans_id: result.transactionId });

      const updated = await testPrisma.paymentInstallment.findUniqueOrThrow({
        where: { id: installment.id },
      });
      expect(updated.status).toBe('EN_ATTENTE'); // jamais marqué PAYE
    });

    it('désaccord webhook/vérification : refuse si CinetPay dit REFUSED malgré un POST prétendument accepté', async () => {
      const user = await createUserFixture();
      const { units } = await createProjectWithBlockAndUnits(1);
      const { schedule } = await createReservationWithSchedule({
        userId: user.id,
        unitId: units[0].id,
      });
      const installment = schedule.installments.find((i) => i.label === 'Tranche fondations')!;

      const result = await service.initiatePayment(installment.id, 'CINETPAY', user.id);

      cinetPayClient.checkPaymentStatus.mockResolvedValueOnce({
        code: '627',
        status: 'REFUSED',
        amount: String(installment.amount),
        currency: 'XOF',
      });

      await service.handleCinetPayWebhook({ cpm_trans_id: result.transactionId });

      const updated = await testPrisma.paymentInstallment.findUniqueOrThrow({
        where: { id: installment.id },
      });
      expect(updated.status).toBe('EN_ATTENTE'); // jamais marqué PAYE
    });

    it('ignore un webhook pour une transaction inconnue (aucun providerRef)', async () => {
      await expect(
        service.handleCinetPayWebhook({ cpm_trans_id: 'CPM-INTROUVABLE' }),
      ).resolves.toBeUndefined();

      expect(cinetPayClient.checkPaymentStatus).not.toHaveBeenCalled();
    });

    it('leve BadRequestException si cpm_trans_id manque', async () => {
      await expect(
        service.handleCinetPayWebhook({} as CinetPayWebhookPayload),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ──────────────────────────────────────────────────
  // handleStripeWebhook
  // ──────────────────────────────────────────────────

  describe('handleStripeWebhook', () => {
    it('marque l\'échéance PAYE si event = checkout.session.completed + metadata.installmentId', async () => {
      const user = await createUserFixture();
      const { units } = await createProjectWithBlockAndUnits(1);
      const { schedule } = await createReservationWithSchedule({
        userId: user.id,
        unitId: units[0].id,
      });
      const installment = schedule.installments.find((i) => i.label === 'Tranche fondations')!;

      // constructEvent retourne l'event parse -> signature OK
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

      const rawBody = JSON.stringify({
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_123', metadata: { installmentId: installment.id } } },
      });

      await service.handleStripeWebhook(rawBody, 'stripe-sig-valid');

      const updated = await testPrisma.paymentInstallment.findUniqueOrThrow({
        where: { id: installment.id },
      });
      expect(updated.status).toBe('PAYE');
      expect(updated.providerRef).toBe('pi_456');
    });

    it('ignore un event Stripe qui n\'est pas checkout.session.completed', async () => {
      stripeClient.constructEvent.mockReturnValueOnce({
        type: 'payment_intent.payment_failed',
        data: { object: {} },
      });

      // Ne doit pas lever
      await service.handleStripeWebhook(
        JSON.stringify({ type: 'payment_intent.payment_failed' }),
        'sig',
      );

      // Aucun write sur les installments -> on peut juste vérifier l'absence d'erreur
    });

    it('leve BadRequestException si metadata.installmentId manque sur le checkout.session.completed', async () => {
      stripeClient.constructEvent.mockReturnValueOnce({
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_x', payment_intent: 'pi_x' } },
      });

      await expect(
        service.handleStripeWebhook(
          JSON.stringify({ type: 'checkout.session.completed' }),
          'sig',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
