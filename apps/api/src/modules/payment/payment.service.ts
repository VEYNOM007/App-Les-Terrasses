import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationService } from '../reservation/reservation.service';
import { NotificationService } from '../notification/notification.service';
import { InstallmentStatus, PaymentProvider } from '@prisma/client';

/**
 * Découpage d'échéancier par défaut pour un logement entrée de gamme.
 * Pourcentages appliqués au prix total de l'unité — configurable par
 * projet si besoin plus tard (ex: table ProjectPaymentPlan).
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
  ) {}

  /**
   * Génère l'échéancier au moment de la création de la réservation.
   * Appelé juste après reserveUnit() dans le controller, ou via un event
   * listener sur la création de Reservation si on préfère découpler.
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
   * L'appel réel à CinetPay/Stripe (création de session/lien) est délégué
   * à des clients dédiés (CinetPayClient, StripeClient) non détaillés ici
   * — leur seul rôle est de créer la session côté provider et de
   * retourner une providerRef stockée pour le rapprochement webhook.
   */
  async initiatePayment(installmentId: string, provider: PaymentProvider, userId: string) {
    const installment = await this.prisma.paymentInstallment.findUniqueOrThrow({
      where: { id: installmentId },
      include: { schedule: { include: { reservation: true } } },
    });

    if (installment.schedule.reservation.userId !== userId) {
      throw new BadRequestException("Cette échéance n'appartient pas à cet utilisateur.");
    }
    if (installment.status === InstallmentStatus.PAYE) {
      throw new BadRequestException('Cette échéance est déjà payée.');
    }

    // session = await this.cinetPay.createSession(...) ou this.stripe.createCheckoutSession(...)
    // selon `provider` — client injecté au constructeur, omis ici par souci de longueur.
    throw new Error('À implémenter : appel au client CinetPay/Stripe selon provider.');
  }

  /**
   * Point d'entrée unique pour marquer une échéance payée, quel que soit
   * le provider. Appelé par les deux handlers de webhook ci-dessous.
   *
   * Idempotent : si l'échéance est déjà PAYE (webhook renvoyé deux fois
   * par le provider, cas fréquent), on ne fait rien.
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

    // Première échéance (acompte) payée → on confirme la réservation,
    // ce qui passe l'unité en VENDU côté ReservationService.
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
   * Webhook CinetPay — vérifie la signature avant tout traitement.
   * CinetPay envoie un `cpm_trans_id` qu'on doit avoir stocké comme
   * providerRef lors de l'initiation du paiement (POST /payments/installments/{id}/pay).
   */
  async handleCinetPayWebhook(payload: any, signatureHeader: string) {
    this.verifyCinetPaySignature(payload, signatureHeader);

    if (payload.cpm_result !== '00') {
      this.logger.warn(`Paiement CinetPay échoué pour ${payload.cpm_trans_id}`);
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
    if (event.type !== 'checkout.session.completed') {
      return;
    }

    const session = event.data.object;
    const installmentId = session.metadata?.installmentId;
    if (!installmentId) {
      throw new BadRequestException('metadata.installmentId manquant dans le webhook Stripe.');
    }

    await this.markInstallmentPaid(installmentId, PaymentProvider.STRIPE, session.payment_intent);
  }

  private verifyCinetPaySignature(payload: any, signatureHeader: string) {
    // TODO: implémenter la vérification HMAC selon la doc CinetPay
    // (token du site + concaténation des champs du payload).
    // Ne jamais traiter un webhook sans cette vérification en production.
    if (!signatureHeader) {
      throw new BadRequestException('Signature CinetPay manquante.');
    }
  }
}
