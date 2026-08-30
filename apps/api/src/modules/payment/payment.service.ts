import { Inject, Injectable, NotFoundException, Logger, BadRequestException, ConflictException, forwardRef } from '@nestjs/common';
import type Stripe from 'stripe';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ReservationService } from '../reservation/reservation.service';
import { ContractService } from '../contract/contract.service';
import { NotificationService } from '../notification/notification.service';
import { InstallmentStatus, PaymentProvider, ReservationStatus, UserRole, KycStatus } from '@prisma/client';
import { CinetPayClient } from './cinetpay.client';
import { StripeClient } from './stripe.client';
import {
  buildInstallmentPlan,
  DEFAULT_INSTALLMENT_PLAN,
  DEFAULT_DOWN_PAYMENT_PERCENT,
} from '../../common/payment/installment-plan';
import { convertXofToEurCents, resolveXofToEurRate } from '../../common/payment/eur-conversion';

/**
 * Contract minimal d'un webhook CinetPay — seuls les champs lus par le
 * service sont déclarés. Les champs supplémentaires envoyés par CinetPay
 * sont ignores sans casser le typage. Le POST webhook sert uniquement de
 * déclencheur : aucun statut de ce payload n'est cru tel quel.
 */
export interface CinetPayWebhookPayload {
  cpm_trans_id: string;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ReservationService))
    private readonly reservationService: ReservationService,
    private readonly contractService: ContractService,
    private readonly notifications: NotificationService,
    private readonly cinetPayClient: CinetPayClient,
    private readonly stripeClient: StripeClient,
  ) {}

  /**
   * Génère l'échéancier au moment de la création de la réservation.
   * Le montant de référence est le montant RÉELLEMENT ENGAGÉ :
   * `offerPrice` si une offre a été accordée, sinon le prix public `unit.price`.
   * Le découpage en tranches vient de la fonction pure partagée
   * (common/payment/installment-plan.ts) — seule source de vérité.
   */
  async generateSchedule(reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { unit: true },
    });

    if (!reservation) throw new NotFoundException('Réservation introuvable.');

    const totalAmount = (reservation.offerPrice ?? reservation.unit.price).toNumber();
    const plan = buildInstallmentPlan({
      totalAmount,
      downPaymentPercent: DEFAULT_DOWN_PAYMENT_PERCENT,
    });

    const schedule = await this.prisma.paymentSchedule.create({
      data: {
        reservationId,
        totalAmount,
        currency: reservation.unit.currency,
        installments: {
          create: plan.map((item) => ({
            label: item.label,
            amount: item.amount,
            dueDate: item.dueDate,
            status: InstallmentStatus.EN_ATTENTE,
          })),
        },
      },
      include: { installments: true },
    });

    return schedule;
  }

  /**
   * Échéancier de paiement d'une réservation — réservé à son propriétaire.
   * 404 si l'échéancier (ou la réservation) n'existe pas pour ce user :
   * on ne révèle pas l'existence d'une réservation d'un tiers.
   */
  async getSchedule(reservationId: string, userId: string) {
    const schedule = await this.prisma.paymentSchedule.findFirst({
      where: { reservation: { id: reservationId, userId } },
      include: { installments: { orderBy: { dueDate: 'asc' } } },
    });

    if (!schedule) {
      throw new NotFoundException('Échéancier introuvable pour cette réservation.');
    }

    return {
      reservationId,
      totalAmount: schedule.totalAmount,
      currency: schedule.currency,
      installments: schedule.installments,
    };
  }

  /**
   * Historique de paiement de l'utilisateur : toutes les échéances de
   * ses réservations, la plus proche de l'échéance en premier.
   */
  async getHistory(userId: string) {
    return this.prisma.paymentInstallment.findMany({
      where: { schedule: { reservation: { userId } } },
      include: {
        schedule: {
          select: { reservation: { select: { id: true, unitId: true } } },
        },
      },
      orderBy: { dueDate: 'desc' },
    });
  }

  /**
   * Initie le paiement d'une échéance auprès du provider choisi.
   */
  async initiatePayment(installmentId: string, provider: PaymentProvider, userId: string) {
    const installment = await this.prisma.paymentInstallment.findUniqueOrThrow({
      where: { id: installmentId },
      include: { schedule: { include: { reservation: { include: { user: true } } } } },
    });

    if (installment.schedule.reservation.userId !== userId) {
      throw new BadRequestException("Cette échéance n'appartient pas à cet utilisateur.");
    }
    if (installment.status === InstallmentStatus.PAYE) {
      throw new BadRequestException('Cette échéance est déjà payée.');
    }
    if (installment.schedule.reservation.status === ReservationStatus.ANNULEE) {
      throw new BadRequestException(
        'Cette réservation a été annulée. Le paiement n\'est plus possible.',
      );
    }

    // GATE KYC (décision produit) : l'acheteur ne peut payer l'ACOMPTE que si
    // sa vérification d'identité a été VALIDÉE par l'administration. Calqué
    // sur le gate de signature de contrat (C4) — fail-closed : user non
    // VALIDE = refusé. Placé AVANT tout appel provider (CinetPay/Stripe) :
    // aucune session de paiement n'est ouverte pour un achat non vérifié.
    // Ne concerne que la première échéance (celle qui scelle le logement) ;
    // les tranches suivantes restent payables quel que soit le statut KYC.
    const isFirstInstallment = installment.label === DEFAULT_INSTALLMENT_PLAN[0].label;
    if (isFirstInstallment) {
      const buyer = installment.schedule.reservation.user;
      if (!buyer || buyer.kycStatus !== KycStatus.VALIDE) {
        throw new ConflictException(
          'Votre vérification d\'identité doit être validée avant de pouvoir payer l\'acompte. Veuillez soumettre votre pièce d\'identité.',
        );
      }
    }

    const transactionId = `TX-${installment.id.substring(0, 8)}-${Date.now()}`;

    if (provider === PaymentProvider.CINETPAY || provider === PaymentProvider.MOBILE_MONEY) {
      const user = installment.schedule.reservation.user;
      const session = await this.cinetPayClient.createPaymentSession({
        transactionId,
        amount: Number(installment.amount),
        currency: installment.schedule.currency,
        description: `Paiement ${installment.label} - Résidence Baguida`,
        installmentId: installment.id,
        customerName: user.fullName,
        customerEmail: user.email,
        customerPhone: user.phone,
      });

      await this.prisma.paymentInstallment.update({
        where: { id: installmentId },
        data: {
          provider: PaymentProvider.CINETPAY,
          providerRef: transactionId,
        },
      });

      return {
        paymentUrl: session.paymentUrl,
        transactionId,
        provider: PaymentProvider.CINETPAY,
      };
    }

    if (provider === PaymentProvider.STRIPE) {
      const user = installment.schedule.reservation.user;
      // Stripe facture en EUR pour la diaspora : les échéances restent en
      // XOF (prix catalogue), la conversion EUR n'intervient qu'ici.
      const amountEurCents = convertXofToEurCents(
        Number(installment.amount),
        resolveXofToEurRate(),
      );
      const session = await this.stripeClient.createCheckoutSession({
        transactionId,
        amountEurCents,
        description: `Paiement ${installment.label} - Résidence Baguida`,
        installmentId: installment.id,
        customerEmail: user.email,
      });

      await this.prisma.paymentInstallment.update({
        where: { id: installmentId },
        data: {
          provider: PaymentProvider.STRIPE,
          providerRef: transactionId,
        },
      });

      return {
        paymentUrl: session.checkoutUrl,
        sessionId: session.sessionId,
        transactionId,
        provider: PaymentProvider.STRIPE,
      };
    }

    throw new BadRequestException(`Provider ${provider} non supporté dans cette méthode.`);
  }

  /**
   * Point d'entrée unique pour marquer une échéance payée, quel que soit le provider (idempotent).
   */
  async markInstallmentPaid(
    installmentId: string,
    provider: PaymentProvider,
    providerRef: string,
  ) {
    const installment = await this.prisma.paymentInstallment.findUnique({
      where: { id: installmentId },
      include: {
        schedule: { include: { reservation: { include: { user: true } }, installments: true } },
      },
    });

    if (!installment) {
      this.logger.warn(`Installment ${installmentId} introuvable pour webhook ${provider}.`);
      return;
    }

    if (installment.status === InstallmentStatus.PAYE) {
      this.logger.log(`Installment ${installmentId} déjà marqué payé, webhook ignoré (idempotence).`);
      return;
    }

    await this.prisma.paymentInstallment.update({
      where: { id: installmentId },
      data: {
        status: InstallmentStatus.PAYE,
        provider,
        providerRef,
        paidAt: new Date(),
      },
    });

    const { reservation, installments } = installment.schedule;

    // Première échéance (acompte) payée → on confirme la réservation et on
    // génère automatiquement le contrat de vente. La garde anti-doublon de
    // generateBuyerContract rend ce déclenchement idempotent : un webhook
    // rejoué (déjà ignoré plus haut par le statut PAYE) ou un rappel ne
    // créeront jamais un doublon ni n'écraseront une signature.
    const isFirstInstallment = installment.label === DEFAULT_INSTALLMENT_PLAN[0].label;
    if (isFirstInstallment) {
      await this.reservationService.confirmReservation(reservation.id);
      if (reservation.user) {
        await this.contractService.generateBuyerContract(
          reservation.id,
          reservation.userId,
          reservation.user.role ?? UserRole.ACHETEUR,
        );
      }
    }

    await this.notifications.notifyUser(reservation.userId, {
      title: 'Paiement reçu',
      body: `Votre paiement pour "${installment.label}" a bien été enregistré.`,
    });

    const allPaid = installments.every((i) =>
      i.id === installmentId ? true : i.status === InstallmentStatus.PAYE,
    );
    if (allPaid) {
      this.logger.log(`Échéancier ${installment.scheduleId} intégralement soldé.`);
    }
  }

  /**
   * Webhook CinetPay — le POST n'est qu'un déclencheur (CinetPay ne signe
   * pas ses notifications et n'y transmet pas de statut fiable). L'échéance
   * est retrouvée par la transaction que NOUS avons émise à l'initiation
   * (providerRef), puis l'état réel est rappelé serveur-à-serveur via
   * /v2/payment/check. `markInstallmentPaid` n'est appelé que si CinetPay
   * confirme ACCEPTED (code 00) ET le montant payé correspond à l'échéance.
   */
  async handleCinetPayWebhook(payload: CinetPayWebhookPayload) {
    const transactionId = payload.cpm_trans_id;
    if (!transactionId) {
      throw new BadRequestException('cpm_trans_id manquant dans le webhook CinetPay.');
    }

    const installment = await this.prisma.paymentInstallment.findFirst({
      where: { providerRef: transactionId },
    });

    if (!installment) {
      this.logger.warn(`Webhook CinetPay ignoré : aucune échéance liée à la transaction ${transactionId}.`);
      return;
    }

    const status = await this.cinetPayClient.checkPaymentStatus(transactionId);

    if (status.code !== '00' || status.status !== 'ACCEPTED') {
      this.logger.warn(
        `Paiement CinetPay ${transactionId} non accepté (code=${status.code}, statut=${status.status}) — échéance inchangée.`,
      );
      return;
    }

    const paidAmount = Number(status.amount);
    const expectedAmount = Number(installment.amount);
    if (paidAmount !== expectedAmount) {
      this.logger.error(
        `Webhook CinetPay refusé : montant vérifié ${paidAmount} ${status.currency} != montant attendu ${expectedAmount} pour l'échéance ${installment.id}.`,
      );
      return;
    }

    await this.markInstallmentPaid(installment.id, PaymentProvider.CINETPAY, transactionId);
  }

  /**
   * Webhook Stripe — la signature HMAC est STRICTEMENT vérifiée via le SDK
   * officiel (stripe.webhooks.constructEvent). Un événement non vérifié est
   * rejeté avant tout traitement. Le payload signé EST la source de vérité
   * (pas de rappel serveur-à-serveur, contrairement à CinetPay) : on traite
   * checkout.session.completed avec un garde-fou de montant (amount_total
   * recalculé en EUR depuis l'échéance), et on ne valide jamais un échec
   * (session expirée, carte refusée, paiement annulé).
   */
  async handleStripeWebhook(rawBody: Buffer | string, signatureHeader: string | undefined) {
    const event = this.stripeClient.constructEvent(rawBody, signatureHeader);

    if (event.type !== 'checkout.session.completed') {
      if (
        event.type === 'checkout.session.expired' ||
        event.type === 'payment_intent.payment_failed' ||
        event.type === 'payment_intent.canceled'
      ) {
        this.logger.warn(
          `Paiement Stripe ${event.id} (${event.type}) — échéance inchangée, aucun paiement validé.`,
        );
      }
      return;
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const installmentId = session.metadata?.installmentId;
    if (!installmentId) {
      throw new BadRequestException('metadata.installmentId manquant dans le webhook Stripe.');
    }

    const installment = await this.prisma.paymentInstallment.findUnique({
      where: { id: installmentId },
    });
    if (!installment) {
      this.logger.warn(
        `Webhook Stripe ignoré : échéance ${installmentId} introuvable pour la session ${session.id}.`,
      );
      return;
    }

    // Garde-fou montant : Stripe doit avoir débité EXACTEMENT le montant EUR
    // correspondant à l'échéance (taux XOF→EUR). Désaccord ⇒ jamais PAYE.
    const expectedEurCents = convertXofToEurCents(
      Number(installment.amount),
      resolveXofToEurRate(),
    );
    if (session.amount_total !== expectedEurCents) {
      this.logger.error(
        `Webhook Stripe refusé : montant débité ${session.amount_total} EUR cents != montant attendu ${expectedEurCents} pour l'échéance ${installment.id}.`,
      );
      return;
    }

    // Stripe garantit un `id` sur toute session checkout ; il sert de
    // fallback si payment_intent est absent (async payment methods). On
    // n'utilise que la forme string (jamais l'objet étendu).
    const paymentIntentId =
      typeof session.payment_intent === 'string' ? session.payment_intent : null;
    const providerRef = paymentIntentId ?? session.id;
    if (!providerRef) {
      throw new BadRequestException('Référence de session Stripe manquante.');
    }

    await this.markInstallmentPaid(installment.id, PaymentProvider.STRIPE, providerRef);
  }
}
