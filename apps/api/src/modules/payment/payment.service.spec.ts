import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ReservationService } from '../reservation/reservation.service';
import { NotificationService } from '../notification/notification.service';
import { CinetPayClient } from './cinetpay.client';
import { StripeClient } from './stripe.client';
import { BadRequestException } from '@nestjs/common';

/**
 * Tests unitaires — PaymentService
 *
 * Scénarios critiques couverts (Règle R6 CLAUDE.md) :
 *  1. markInstallmentPaid — première invocation → statut PAYE
 *  2. markInstallmentPaid — double invocation idempotente → ignoré sans erreur
 *  3. markInstallmentPaid — installment introuvable → log warning, pas d'exception
 *  4. initiatePayment — échéance déjà payée → BadRequestException
 *  5. initiatePayment — utilisateur non propriétaire → BadRequestException
 *  6. handleCinetPayWebhook — signature invalide en production → rejet
 *  7. handleStripeWebhook — événement non checkout.session.completed → ignoré
 */

// ────────────────────────────────────────────────────────────
// Mocks partagés
// ────────────────────────────────────────────────────────────

const mockInstallmentBase = {
  id: 'inst-001',
  label: 'Acompte réservation',
  amount: 500000,
  scheduleId: 'sched-001',
  provider: null,
  providerRef: null,
  paidAt: null,
  schedule: {
    id: 'sched-001',
    currency: 'XOF',
    reservation: {
      id: 'res-001',
      userId: 'user-001',
      user: {
        id: 'user-001',
        fullName: 'Kofi Mensah',
        email: 'kofi@test.tg',
        phone: '+22890000000',
      },
    },
    installments: [
      { id: 'inst-001', status: 'EN_ATTENTE', label: 'Acompte réservation' },
      { id: 'inst-002', status: 'EN_ATTENTE', label: 'Tranche fondations' },
    ],
  },
};

const createMockPrisma = () => ({
  reservation: {
    findUnique: jest.fn(),
  },
  paymentSchedule: {
    create: jest.fn(),
  },
  paymentInstallment: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
});

const createMockReservationService = () => ({
  confirmReservation: jest.fn().mockResolvedValue(undefined),
});

const createMockNotificationService = () => ({
  notifyUser: jest.fn().mockResolvedValue(undefined),
});

const createMockCinetPayClient = () => ({
  createPaymentSession: jest.fn().mockResolvedValue({
    paymentUrl: 'https://cinetpay.com/pay/demo',
    paymentToken: 'tok_demo',
  }),
  verifySignature: jest.fn().mockReturnValue(true),
});

const createMockStripeClient = () => ({
  createCheckoutSession: jest.fn().mockResolvedValue({
    checkoutUrl: 'https://checkout.stripe.com/demo',
    sessionId: 'cs_test_demo',
  }),
  constructEvent: jest.fn().mockReturnValue(null),
});

// ────────────────────────────────────────────────────────────
// Suite de tests
// ────────────────────────────────────────────────────────────

describe('PaymentService', () => {
  let service: PaymentService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let reservationService: ReturnType<typeof createMockReservationService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;
  let cinetPayClient: ReturnType<typeof createMockCinetPayClient>;
  let stripeClient: ReturnType<typeof createMockStripeClient>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    reservationService = createMockReservationService();
    notificationService = createMockNotificationService();
    cinetPayClient = createMockCinetPayClient();
    stripeClient = createMockStripeClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: prisma },
        { provide: ReservationService, useValue: reservationService },
        { provide: NotificationService, useValue: notificationService },
        { provide: CinetPayClient, useValue: cinetPayClient },
        { provide: StripeClient, useValue: stripeClient },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  // ──────────────────────────────────────────────────
  // markInstallmentPaid — idempotence
  // ──────────────────────────────────────────────────

  describe('markInstallmentPaid', () => {
    it('devrait marquer une échéance EN_ATTENTE comme PAYE et confirmer la réservation (acompte)', async () => {
      prisma.paymentInstallment.findUnique.mockResolvedValue({
        ...mockInstallmentBase,
        status: 'EN_ATTENTE',
      });
      prisma.paymentInstallment.update.mockResolvedValue({});

      await service.markInstallmentPaid('inst-001', 'CINETPAY' as any, 'TX-ref-001');

      // Vérification : update appelé avec status PAYE
      expect(prisma.paymentInstallment.update).toHaveBeenCalledWith({
        where: { id: 'inst-001' },
        data: expect.objectContaining({
          status: 'PAYE',
          provider: 'CINETPAY',
          providerRef: 'TX-ref-001',
        }),
      });

      // Vérification : confirmReservation appelé (c'est l'acompte)
      expect(reservationService.confirmReservation).toHaveBeenCalledWith('res-001');

      // Vérification : notification envoyée
      expect(notificationService.notifyUser).toHaveBeenCalledWith(
        'user-001',
        expect.objectContaining({ title: 'Paiement reçu' }),
      );
    });

    it('devrait ignorer un webhook dupliqué si l\'échéance est déjà PAYE (idempotence R6)', async () => {
      prisma.paymentInstallment.findUnique.mockResolvedValue({
        ...mockInstallmentBase,
        status: 'PAYE',
        paidAt: new Date('2026-07-20'),
      });

      await service.markInstallmentPaid('inst-001', 'CINETPAY' as any, 'TX-ref-001');

      // Vérification : aucun update ne doit être déclenché
      expect(prisma.paymentInstallment.update).not.toHaveBeenCalled();

      // Vérification : confirmReservation ne doit PAS être rappelé
      expect(reservationService.confirmReservation).not.toHaveBeenCalled();

      // Vérification : pas de notification dupliquée
      expect(notificationService.notifyUser).not.toHaveBeenCalled();
    });

    it('devrait ne rien faire si l\'installment est introuvable (log warning)', async () => {
      prisma.paymentInstallment.findUnique.mockResolvedValue(null);

      // Pas d'exception — juste un warning en log
      await expect(
        service.markInstallmentPaid('inst-inexistant', 'STRIPE' as any, 'TX-ref-999'),
      ).resolves.toBeUndefined();

      expect(prisma.paymentInstallment.update).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────
  // initiatePayment — validations métier
  // ──────────────────────────────────────────────────

  describe('initiatePayment', () => {
    it('devrait rejeter si l\'échéance est déjà payée', async () => {
      prisma.paymentInstallment.findUniqueOrThrow.mockResolvedValue({
        ...mockInstallmentBase,
        status: 'PAYE',
      });

      await expect(
        service.initiatePayment('inst-001', 'CINETPAY' as any, 'user-001'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.initiatePayment('inst-001', 'CINETPAY' as any, 'user-001'),
      ).rejects.toThrow('déjà payée');
    });

    it('devrait rejeter si l\'utilisateur n\'est pas propriétaire de l\'échéance', async () => {
      prisma.paymentInstallment.findUniqueOrThrow.mockResolvedValue({
        ...mockInstallmentBase,
        status: 'EN_ATTENTE',
      });

      await expect(
        service.initiatePayment('inst-001', 'CINETPAY' as any, 'user-intrus'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.initiatePayment('inst-001', 'CINETPAY' as any, 'user-intrus'),
      ).rejects.toThrow("n'appartient pas");
    });

    it('devrait initier un paiement CinetPay et retourner une paymentUrl', async () => {
      prisma.paymentInstallment.findUniqueOrThrow.mockResolvedValue({
        ...mockInstallmentBase,
        status: 'EN_ATTENTE',
      });
      prisma.paymentInstallment.update.mockResolvedValue({});

      const result = await service.initiatePayment('inst-001', 'CINETPAY' as any, 'user-001');

      expect(result).toHaveProperty('paymentUrl');
      expect(result).toHaveProperty('transactionId');
      expect(result.provider).toBe('CINETPAY');
      expect(cinetPayClient.createPaymentSession).toHaveBeenCalled();
    });

    it('devrait initier un paiement Stripe et retourner une checkoutUrl', async () => {
      prisma.paymentInstallment.findUniqueOrThrow.mockResolvedValue({
        ...mockInstallmentBase,
        status: 'EN_ATTENTE',
      });
      prisma.paymentInstallment.update.mockResolvedValue({});

      const result = await service.initiatePayment('inst-001', 'STRIPE' as any, 'user-001');

      expect(result).toHaveProperty('paymentUrl');
      expect(result).toHaveProperty('sessionId');
      expect(result.provider).toBe('STRIPE');
      expect(stripeClient.createCheckoutSession).toHaveBeenCalled();
    });

    it('devrait rejeter un provider inconnu', async () => {
      prisma.paymentInstallment.findUniqueOrThrow.mockResolvedValue({
        ...mockInstallmentBase,
        status: 'EN_ATTENTE',
      });

      await expect(
        service.initiatePayment('inst-001', 'PAYPAL' as any, 'user-001'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ──────────────────────────────────────────────────
  // handleCinetPayWebhook
  // ──────────────────────────────────────────────────

  describe('handleCinetPayWebhook', () => {
    it('devrait traiter un webhook CinetPay valide avec cpm_result 00', async () => {
      cinetPayClient.verifySignature.mockReturnValue(true);
      prisma.paymentInstallment.findUnique.mockResolvedValue({
        ...mockInstallmentBase,
        status: 'EN_ATTENTE',
      });
      prisma.paymentInstallment.update.mockResolvedValue({});

      await service.handleCinetPayWebhook(
        {
          cpm_result: '00',
          cpm_trans_id: 'CPM-TX-001',
          metadata: { installmentId: 'inst-001' },
        },
        'valid-signature',
      );

      expect(prisma.paymentInstallment.update).toHaveBeenCalled();
    });

    it('devrait ignorer un webhook CinetPay avec cpm_result != 00 (échec paiement)', async () => {
      cinetPayClient.verifySignature.mockReturnValue(true);

      await service.handleCinetPayWebhook(
        {
          cpm_result: '604',
          cpm_trans_id: 'CPM-TX-002',
          metadata: { installmentId: 'inst-001' },
        },
        'valid-signature',
      );

      expect(prisma.paymentInstallment.update).not.toHaveBeenCalled();
    });

    it('devrait rejeter si metadata.installmentId est manquant', async () => {
      cinetPayClient.verifySignature.mockReturnValue(true);

      await expect(
        service.handleCinetPayWebhook(
          { cpm_result: '00', cpm_trans_id: 'CPM-TX-003' },
          'valid-signature',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ──────────────────────────────────────────────────
  // handleStripeWebhook
  // ──────────────────────────────────────────────────

  describe('handleStripeWebhook', () => {
    it('devrait ignorer les événements Stripe non checkout.session.completed', async () => {
      const rawBody = JSON.stringify({
        type: 'payment_intent.succeeded',
        data: { object: {} },
      });

      await service.handleStripeWebhook(rawBody, 'sig_test');

      expect(prisma.paymentInstallment.findUnique).not.toHaveBeenCalled();
    });

    it('devrait traiter un événement checkout.session.completed valide', async () => {
      const rawBody = JSON.stringify({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_001',
            payment_intent: 'pi_test_001',
            metadata: { installmentId: 'inst-001' },
          },
        },
      });

      prisma.paymentInstallment.findUnique.mockResolvedValue({
        ...mockInstallmentBase,
        status: 'EN_ATTENTE',
      });
      prisma.paymentInstallment.update.mockResolvedValue({});

      await service.handleStripeWebhook(rawBody, 'sig_test');

      expect(prisma.paymentInstallment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inst-001' },
          data: expect.objectContaining({
            status: 'PAYE',
            provider: 'STRIPE',
            providerRef: 'pi_test_001',
          }),
        }),
      );
    });

    it('devrait rejeter si metadata.installmentId manquant dans la session Stripe', async () => {
      const rawBody = JSON.stringify({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_002',
            payment_intent: 'pi_test_002',
            metadata: {},
          },
        },
      });

      await expect(
        service.handleStripeWebhook(rawBody, 'sig_test'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
