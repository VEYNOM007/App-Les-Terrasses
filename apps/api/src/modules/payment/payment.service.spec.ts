import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService, CinetPayWebhookPayload } from './payment.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ReservationService } from '../reservation/reservation.service';
import { NotificationService } from '../notification/notification.service';
import { ContractService } from '../contract/contract.service';
import { CinetPayClient } from './cinetpay.client';
import { StripeClient } from './stripe.client';
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PaymentProvider, UserRole } from '@prisma/client';

/**
 * Tests unitaires — PaymentService
 *
 * Scénarios critiques couverts (Règle R6 CLAUDE.md) :
 *  1. markInstallmentPaid — première invocation → statut PAYE
 *  2. markInstallmentPaid — double invocation idempotente → ignoré sans erreur
 *  3. markInstallmentPaid — installment introuvable → log warning, pas d'exception
 *  *  markInstallmentPaid — acompte payé → ContractService.generateBuyerContract appelé UNE FOIS (R6)
 *  *  markInstallmentPaid — tranche suivante (hors acompte) → contrat NON généré (R6)
 *  *  markInstallmentPaid — webhook acompte rejoué (déjà PAYE) → contrat NON regénéré (R6)
 *  4. initiatePayment — échéance déjà payée → BadRequestException
 *  5. initiatePayment — utilisateur non propriétaire → BadRequestException
 *  6. handleCinetPayWebhook — vérification serveur-à-serveur ACCEPTED + montant → PAYE
 *  7. handleCinetPayWebhook — désaccord webhook/vérification (ACCEPTED vs REFUSED) → jamais PAYE
 *  8. handleCinetPayWebhook — désaccord de montant (montant CinetPay ≠ échéance) → jamais PAYE
 *  9. handleCinetPayWebhook — PENDING → échéance inchangée
 * 10. handleCinetPayWebhook — transaction inconnue → ignoré
 * 11. handleCinetPayWebhook — indisponibilité CinetPay → rejet, jamais PAYE
 * 12. handleStripeWebhook — signature invalide (constructEvent lève) → propagé, aucune lecture DB
 * 13. handleStripeWebhook — désaccord de montant (amount_total ≠ échéance convertie en EUR) → jamais PAYE
 * 14. handleStripeWebhook — événements d'échec (session expirée, carte refusée, annulé) → échéance inchangée
 * 15. initiatePayment STRIPE — échéance XOF convertie en centimes EUR avant appel Stripe
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
    findFirst: jest.fn(),
  },
  paymentInstallment: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
});

const createMockReservationService = () => ({
  confirmReservation: jest.fn().mockResolvedValue(undefined),
});

const createMockContractService = () => ({
  generateBuyerContract: jest.fn().mockResolvedValue({ id: 'contract-001' }),
});

const createMockNotificationService = () => ({
  notifyUser: jest.fn().mockResolvedValue(undefined),
});

const createMockCinetPayClient = () => ({
  createPaymentSession: jest.fn().mockResolvedValue({
    paymentUrl: 'https://cinetpay.com/pay/demo',
    paymentToken: 'tok_demo',
  }),
  checkPaymentStatus: jest.fn().mockResolvedValue({
    code: '00',
    status: 'ACCEPTED',
    amount: '500000',
    currency: 'XOF',
  }),
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
  let contractService: ReturnType<typeof createMockContractService>;
  let notificationService: ReturnType<typeof createMockNotificationService>;
  let cinetPayClient: ReturnType<typeof createMockCinetPayClient>;
  let stripeClient: ReturnType<typeof createMockStripeClient>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    reservationService = createMockReservationService();
    contractService = createMockContractService();
    notificationService = createMockNotificationService();
    cinetPayClient = createMockCinetPayClient();
    stripeClient = createMockStripeClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: prisma },
        { provide: ReservationService, useValue: reservationService },
        { provide: ContractService, useValue: contractService },
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

      await service.markInstallmentPaid('inst-001', PaymentProvider.CINETPAY, 'TX-ref-001');

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

      await service.markInstallmentPaid('inst-001', PaymentProvider.CINETPAY, 'TX-ref-001');

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
        service.markInstallmentPaid('inst-inexistant', PaymentProvider.STRIPE, 'TX-ref-999'),
      ).resolves.toBeUndefined();

      expect(prisma.paymentInstallment.update).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────
  // markInstallmentPaid — génération du contrat acheteur (R6)
  // ──────────────────────────────────────────────────

  describe('markInstallmentPaid — contrat acheteur (R6)', () => {
    it('devrait générer le contrat acheteur UNE FOIS quand l\'acompte est payé', async () => {
      prisma.paymentInstallment.findUnique.mockResolvedValue({
        ...mockInstallmentBase,
        status: 'EN_ATTENTE',
      });
      prisma.paymentInstallment.update.mockResolvedValue({});

      await service.markInstallmentPaid('inst-001', PaymentProvider.CINETPAY, 'TX-ref-001');

      // L'acompte est la première tranche → déclenchement du contrat.
      expect(contractService.generateBuyerContract).toHaveBeenCalledTimes(1);
      expect(contractService.generateBuyerContract).toHaveBeenCalledWith(
        'res-001',
        'user-001',
        UserRole.ACHETEUR,
      );
    });

    it('ne devrait PAS générer de contrat acheteur pour une tranche suivante (hors acompte)', async () => {
      prisma.paymentInstallment.findUnique.mockResolvedValue({
        ...mockInstallmentBase,
        label: 'Tranche fondations',
        status: 'EN_ATTENTE',
      });
      prisma.paymentInstallment.update.mockResolvedValue({});

      await service.markInstallmentPaid('inst-002', PaymentProvider.CINETPAY, 'TX-ref-002');

      // Seul l'acompte déclenche le contrat : une tranche d'équilibre ne
      // doit jamais le générer, ni confirmer la réservation.
      expect(contractService.generateBuyerContract).not.toHaveBeenCalled();
      expect(reservationService.confirmReservation).not.toHaveBeenCalled();
    });

    it('ne devrait PAS regénérer le contrat si le webhook de l\'acompte est rejoué (déjà PAYE)', async () => {
      prisma.paymentInstallment.findUnique.mockResolvedValue({
        ...mockInstallmentBase,
        status: 'PAYE',
        paidAt: new Date('2026-07-20'),
      });

      await service.markInstallmentPaid('inst-001', PaymentProvider.CINETPAY, 'TX-ref-001');

      // Idempotence : un webhook rejoué sur une échéance déjà payée ne doit
      // ni recréer de contrat, ni reconfirmer la réservation.
      expect(contractService.generateBuyerContract).not.toHaveBeenCalled();
      expect(reservationService.confirmReservation).not.toHaveBeenCalled();
    });
  });

  describe('initiatePayment', () => {
    it('devrait rejeter si l\'échéance est déjà payée', async () => {
      prisma.paymentInstallment.findUniqueOrThrow.mockResolvedValue({
        ...mockInstallmentBase,
        status: 'PAYE',
      });

      await expect(
        service.initiatePayment('inst-001', PaymentProvider.CINETPAY, 'user-001'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.initiatePayment('inst-001', PaymentProvider.CINETPAY, 'user-001'),
      ).rejects.toThrow('déjà payée');
    });

    it('devrait rejeter si l\'utilisateur n\'est pas propriétaire de l\'échéance', async () => {
      prisma.paymentInstallment.findUniqueOrThrow.mockResolvedValue({
        ...mockInstallmentBase,
        status: 'EN_ATTENTE',
      });

      await expect(
        service.initiatePayment('inst-001', PaymentProvider.CINETPAY, 'user-intrus'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.initiatePayment('inst-001', PaymentProvider.CINETPAY, 'user-intrus'),
      ).rejects.toThrow("n'appartient pas");
    });

    it('devrait initier un paiement CinetPay et retourner une paymentUrl', async () => {
      prisma.paymentInstallment.findUniqueOrThrow.mockResolvedValue({
        ...mockInstallmentBase,
        status: 'EN_ATTENTE',
      });
      prisma.paymentInstallment.update.mockResolvedValue({});

      const result = await service.initiatePayment('inst-001', PaymentProvider.CINETPAY, 'user-001');

      expect(result).toHaveProperty('paymentUrl');
      expect(result).toHaveProperty('transactionId');
      expect(result.provider).toBe('CINETPAY');
      expect(cinetPayClient.createPaymentSession).toHaveBeenCalled();
    });

    it('devrait initier un paiement Stripe en EUR (montant converti en centimes) et retourner une checkoutUrl', async () => {
      prisma.paymentInstallment.findUniqueOrThrow.mockResolvedValue({
        ...mockInstallmentBase,
        status: 'EN_ATTENTE',
      });
      prisma.paymentInstallment.update.mockResolvedValue({});

      const result = await service.initiatePayment('inst-001', PaymentProvider.STRIPE, 'user-001');

      expect(result).toHaveProperty('paymentUrl');
      expect(result).toHaveProperty('sessionId');
      expect(result.provider).toBe('STRIPE');

      // Le service convertit l'échéance XOF en centimes EUR avant d'appeler
      // Stripe (500 000 XOF = 762,245 € = 76225 centimes à 655,957 XOF/EUR).
      expect(stripeClient.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          amountEurCents: 76225,
          installmentId: 'inst-001',
          customerEmail: 'kofi@test.tg',
        }),
      );
    });

    it('devrait rejeter un provider inconnu', async () => {
      prisma.paymentInstallment.findUniqueOrThrow.mockResolvedValue({
        ...mockInstallmentBase,
        status: 'EN_ATTENTE',
      });

      await expect(
        service.initiatePayment(
          'inst-001',
          'PAYPAL' as unknown as PaymentProvider,
          'user-001',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('devrait rejeter si la réservation est annulée', async () => {
      prisma.paymentInstallment.findUniqueOrThrow.mockResolvedValue({
        ...mockInstallmentBase,
        status: 'EN_ATTENTE',
        schedule: {
          ...mockInstallmentBase.schedule,
          reservation: {
            ...mockInstallmentBase.schedule.reservation,
            status: 'ANNULEE',
          },
        },
      });

      await expect(
        service.initiatePayment('inst-001', PaymentProvider.STRIPE, 'user-001'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.initiatePayment('inst-001', PaymentProvider.STRIPE, 'user-001'),
      ).rejects.toThrow('annulée');
    });
  });

  // ──────────────────────────────────────────────────
  // getSchedule — échéancier d'une réservation (propriétaire)
  // ──────────────────────────────────────────────────

  describe('getSchedule', () => {
    const scheduleFixture = {
      id: 'sched-001',
      reservationId: 'res-001',
      totalAmount: 24_000_000,
      currency: 'XOF',
      installments: [
        { id: 'inst-001', status: 'PAYE', dueDate: new Date('2026-07-01') },
        { id: 'inst-002', status: 'EN_ATTENTE', dueDate: new Date('2026-09-01') },
      ],
    };

    it('devrait renvoyer l\'échéancier au propriétaire de la réservation', async () => {
      prisma.paymentSchedule.findFirst.mockResolvedValue(scheduleFixture);

      const result = await service.getSchedule('res-001', 'user-001');

      // Le scoping par {id, userId} garantit qu'on ne lit que ses propres réservations
      expect(prisma.paymentSchedule.findFirst).toHaveBeenCalledWith({
        where: { reservation: { id: 'res-001', userId: 'user-001' } },
        include: { installments: { orderBy: { dueDate: 'asc' } } },
      });

      expect(result).toEqual({
        reservationId: 'res-001',
        totalAmount: 24_000_000,
        currency: 'XOF',
        installments: expect.any(Array),
      });
    });

    it('devrait renvoyer 404 si la réservation n\'appartient pas au user (sans fuiter son existence)', async () => {
      prisma.paymentSchedule.findFirst.mockResolvedValue(null);

      await expect(service.getSchedule('res-001', 'user-intrus')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ──────────────────────────────────────────────────
  // getHistory — historique des échéances du user
  // ──────────────────────────────────────────────────

  describe('getHistory', () => {
    it('devrait lister toutes les échéances des réservations du user, plus récentes d\'abord', async () => {
      prisma.paymentInstallment.findMany.mockResolvedValue([
        { id: 'inst-001', status: 'PAYE' },
        { id: 'inst-002', status: 'EN_ATTENTE' },
      ]);

      const result = await service.getHistory('user-001');

      expect(prisma.paymentInstallment.findMany).toHaveBeenCalledWith({
        where: { schedule: { reservation: { userId: 'user-001' } } },
        include: {
          schedule: {
            select: { reservation: { select: { id: true, unitId: true } } },
          },
        },
        orderBy: { dueDate: 'desc' },
      });

      expect(result).toHaveLength(2);
    });
  });

  // ──────────────────────────────────────────────────
  // handleCinetPayWebhook
  // ──────────────────────────────────────────────────

  describe('handleCinetPayWebhook', () => {
    it('devrait marquer PAYE si la vérification serveur-à-serveur confirme ACCEPTED + montant cohérent', async () => {
      prisma.paymentInstallment.findFirst.mockResolvedValue({
        ...mockInstallmentBase,
        status: 'EN_ATTENTE',
      });
      prisma.paymentInstallment.findUnique.mockResolvedValue({
        ...mockInstallmentBase,
        status: 'EN_ATTENTE',
      });
      prisma.paymentInstallment.update.mockResolvedValue({});

      await service.handleCinetPayWebhook({ cpm_trans_id: 'CPM-TX-001' });

      expect(cinetPayClient.checkPaymentStatus).toHaveBeenCalledWith('CPM-TX-001');
      expect(prisma.paymentInstallment.update).toHaveBeenCalled();
    });

    it('désaccord webhook/vérification : jamais PAYE si CinetPay dit REFUSED malgré un POST prétendument accepté', async () => {
      // Le POST webhook peut prétendre un succès — seul /v2/payment/check fait foi.
      cinetPayClient.checkPaymentStatus.mockResolvedValueOnce({
        code: '627',
        status: 'REFUSED',
        amount: '500000',
        currency: 'XOF',
      });
      prisma.paymentInstallment.findFirst.mockResolvedValue({
        ...mockInstallmentBase,
        status: 'EN_ATTENTE',
      });

      await service.handleCinetPayWebhook({ cpm_trans_id: 'CPM-TX-002' });

      expect(prisma.paymentInstallment.update).not.toHaveBeenCalled();
      expect(reservationService.confirmReservation).not.toHaveBeenCalled();
      expect(notificationService.notifyUser).not.toHaveBeenCalled();
    });

    it('désaccord de montant : jamais PAYE si CinetPay confirme ACCEPTED avec un montant != échéance', async () => {
      // transaction_id manipulé pour pointer vers une autre échéance → montant divergent.
      cinetPayClient.checkPaymentStatus.mockResolvedValueOnce({
        code: '00',
        status: 'ACCEPTED',
        amount: '999999',
        currency: 'XOF',
      });
      prisma.paymentInstallment.findFirst.mockResolvedValue({
        ...mockInstallmentBase,
        status: 'EN_ATTENTE',
      });

      await service.handleCinetPayWebhook({ cpm_trans_id: 'CPM-TX-003' });

      expect(prisma.paymentInstallment.update).not.toHaveBeenCalled();
      expect(reservationService.confirmReservation).not.toHaveBeenCalled();
      expect(notificationService.notifyUser).not.toHaveBeenCalled();
    });

    it('devrait laisser l\'échéance inchangée si CinetPay est en attente (PENDING)', async () => {
      cinetPayClient.checkPaymentStatus.mockResolvedValueOnce({
        code: '662',
        status: 'PENDING',
        amount: '500000',
        currency: 'XOF',
      });
      prisma.paymentInstallment.findFirst.mockResolvedValue({
        ...mockInstallmentBase,
        status: 'EN_ATTENTE',
      });

      await service.handleCinetPayWebhook({ cpm_trans_id: 'CPM-TX-004' });

      expect(prisma.paymentInstallment.update).not.toHaveBeenCalled();
    });

    it('devrait ignorer un webhook pour une transaction inconnue (aucun providerRef)', async () => {
      prisma.paymentInstallment.findFirst.mockResolvedValue(null);

      await expect(
        service.handleCinetPayWebhook({ cpm_trans_id: 'CPM-INCONNU' }),
      ).resolves.toBeUndefined();

      expect(cinetPayClient.checkPaymentStatus).not.toHaveBeenCalled();
      expect(prisma.paymentInstallment.update).not.toHaveBeenCalled();
    });

    it('devrait rejeter sans marquer PAYE si la vérification serveur-à-serveur est indisponible', async () => {
      cinetPayClient.checkPaymentStatus.mockRejectedValueOnce(
        new ServiceUnavailableException('CinetPay injoignable'),
      );
      prisma.paymentInstallment.findFirst.mockResolvedValue({
        ...mockInstallmentBase,
        status: 'EN_ATTENTE',
      });

      await expect(service.handleCinetPayWebhook({ cpm_trans_id: 'CPM-TX-005' })).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(prisma.paymentInstallment.update).not.toHaveBeenCalled();
    });

    it('devrait rejeter si cpm_trans_id est manquant', async () => {
      await expect(
        service.handleCinetPayWebhook({} as CinetPayWebhookPayload),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.paymentInstallment.update).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────
  // handleStripeWebhook
  // ──────────────────────────────────────────────────

  describe('handleStripeWebhook', () => {
    it('devrait propager le rejet de signature (constructEvent lève) sans toucher la base', async () => {
      // La vérification est STRICTEMENT faite par le client (constructEvent) :
      // une signature invalide lève BadRequestException avant tout traitement.
      stripeClient.constructEvent.mockImplementationOnce(() => {
        throw new BadRequestException('Signature Stripe invalide.');
      });

      const rawBody = JSON.stringify({ type: 'checkout.session.completed', data: { object: {} } });

      await expect(service.handleStripeWebhook(rawBody, 'sig_invalide')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.paymentInstallment.findUnique).not.toHaveBeenCalled();
      expect(prisma.paymentInstallment.update).not.toHaveBeenCalled();
    });

    it('devrait ignorer les événements Stripe non checkout.session.completed', async () => {
      stripeClient.constructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: {} },
      });

      await service.handleStripeWebhook('raw-body', 'sig_test');

      expect(prisma.paymentInstallment.findUnique).not.toHaveBeenCalled();
    });

    it.each([
      ['checkout.session.expired'],
      ['payment_intent.payment_failed'],
      ['payment_intent.canceled'],
    ])(
      "devrait laisser l'échéance inchangée sur un événement d'échec (%s)",
      async (eventType) => {
        stripeClient.constructEvent.mockReturnValue({
          type: eventType,
          id: 'evt_echec',
          data: { object: { id: 'cs_test_000' } },
        });

        await service.handleStripeWebhook('raw-body', 'sig_test');

        // Jamais de marquage PAYE sur un échec.
        expect(prisma.paymentInstallment.findUnique).not.toHaveBeenCalled();
        expect(prisma.paymentInstallment.update).not.toHaveBeenCalled();
        expect(reservationService.confirmReservation).not.toHaveBeenCalled();
        expect(notificationService.notifyUser).not.toHaveBeenCalled();
      },
    );

    it('devrait traiter un événement checkout.session.completed avec montant conforme', async () => {
      stripeClient.constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_001',
            payment_intent: 'pi_test_001',
            // 500 000 XOF = 76225 centimes EUR (garde-fou montant R6)
            amount_total: 76225,
            metadata: { installmentId: 'inst-001' },
          },
        },
      });

      prisma.paymentInstallment.findUnique.mockResolvedValue({
        ...mockInstallmentBase,
        status: 'EN_ATTENTE',
      });
      prisma.paymentInstallment.update.mockResolvedValue({});

      await service.handleStripeWebhook('raw-body', 'sig_test');

      expect(prisma.paymentInstallment.findUnique).toHaveBeenCalledWith({
        where: { id: 'inst-001' },
      });
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

    it('désaccord de montant : jamais PAYE si amount_total != montant attendu', async () => {
      stripeClient.constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_003',
            payment_intent: 'pi_test_003',
            amount_total: 99999,
            metadata: { installmentId: 'inst-001' },
          },
        },
      });

      prisma.paymentInstallment.findUnique.mockResolvedValue({
        ...mockInstallmentBase,
        status: 'EN_ATTENTE',
      });

      await service.handleStripeWebhook('raw-body', 'sig_test');

      expect(prisma.paymentInstallment.update).not.toHaveBeenCalled();
      expect(reservationService.confirmReservation).not.toHaveBeenCalled();
      expect(notificationService.notifyUser).not.toHaveBeenCalled();
    });

    it('devrait rejeter si metadata.installmentId manquant dans la session Stripe', async () => {
      stripeClient.constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_002',
            payment_intent: 'pi_test_002',
            amount_total: 76225,
            metadata: {},
          },
        },
      });

      await expect(service.handleStripeWebhook('raw-body', 'sig_test')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
