import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ReservationService } from '../reservation/reservation.service';
import { NotificationService } from '../notification/notification.service';
import { InstallmentStatus, PaymentProvider } from '@prisma/client';
import { CinetPayClient } from './cinetpay.client';

/**
 * Découpage d'échéancier par défaut pour un logement entrée de gamme.
 * Pourcentages appliqués au prix total de l'unité.
 */
const DEFAULT_INSTALLMENT_PLAN = [
  { label: 'Acompte réservation', percent: 0.1, daysFromNow: 0 },
  { label: 'Tranche fondations', percent: 0.2, daysFromNow: 60 },
  { label: 'Tranche gros œuvre', percent: 0.3, daysFromNow: 150 },
  { label: 'Tranche finitions', percent: 0.25, daysFromNow: 270 },
  { label: 'Solde livraison', percent: 0.15, daysFromNow: 365 },
];

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservationService: ReservationService,
    private readonly notifications: NotificationService,
    private readonly cinetPayClient: CinetPayClient,
  ) {}

  /**
   * Génère l'échéancier au moment de la création de la réservation.
   */
  async generateSchedule(reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { unit: true },
    });

    if (!reservation) throw new NotFoundException('Réservation introuvable.');

    const totalAmount = reservation.unit.price;

    const schedule = await this.prisma.paymentSchedule.create({
      data: {
        reservationId,
        totalAmount,
        currency: reservation.unit.currency,
        installments: {
          create: DEFAULT_INSTALLMENT_PLAN.map((item) => ({
            label: item.label,
            amount: totalAmount.toNumber() * item.percent,
            dueDate: new Date(Date.now() + item.daysFromNow * 24 * 60 * 60 * 1000),
            status: InstallmentStatus.EN_ATTENTE,
          })),
        },
      },
      include: { installments: true },
    });

    return schedule;
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
      include: { schedule: { include: { reservation: true, installments: true } } },
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

    // Première échéance (acompte) payée → on confirme la réservation
    const isFirstInstallment = installment.label === DEFAULT_INSTALLMENT_PLAN[0].label;
    if (isFirstInstallment) {
      await this.reservationService.confirmReservation(reservation.id);
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
   * Webhook CinetPay — vérifie la signature HMAC avant tout traitement.
   */
  async handleCinetPayWebhook(payload: any, signatureHeader: string) {
    const isValid = this.cinetPayClient.verifySignature(payload, signatureHeader);
    if (!isValid && process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Signature CinetPay invalide.');
    }

    if (payload.cpm_result !== '00') {
      this.logger.warn(`Paiement CinetPay non validé (code ${payload.cpm_result}) pour transaction ${payload.cpm_trans_id}`);
      return;
    }

    const installmentId = payload.metadata?.installmentId;
    if (!installmentId) {
      throw new BadRequestException('metadata.installmentId manquant dans le webhook CinetPay.');
    }

    await this.markInstallmentPaid(installmentId, PaymentProvider.CINETPAY, payload.cpm_trans_id);
  }

  /**
   * Webhook Stripe — événement checkout.session.completed.
   */
  async handleStripeWebhook(event: any) {
    if (event?.type !== 'checkout.session.completed') {
      return;
    }

    const session = event.data?.object;
    const installmentId = session?.metadata?.installmentId;
    if (!installmentId) {
      throw new BadRequestException('metadata.installmentId manquant dans le webhook Stripe.');
    }

    await this.markInstallmentPaid(installmentId, PaymentProvider.STRIPE, session.payment_intent || session.id);
  }
}
