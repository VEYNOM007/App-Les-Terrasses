import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { KycStatus, UnitStatus, ReservationStatus } from '@prisma/client';

interface ExpireReservationJobData {
  reservationId: string;
}

/** Report de 1h tant qu'une pièce KYC est en cours d'examen admin. */
const KYC_HOLD_CHECK_MS = 60 * 60 * 1000;

@Processor('reservation-expiration')
export class ReservationExpirationProcessor extends WorkerHost {
  private readonly logger = new Logger(ReservationExpirationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {
    super();
  }

  async process(job: Job<ExpireReservationJobData>): Promise<void> {
    const { reservationId } = job.data;

    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { user: true },
    });

    if (!reservation) {
      this.logger.warn(`Réservation ${reservationId} introuvable, job ignoré.`);
      return;
    }

    // Si l'acompte a été payé entre-temps, la réservation n'est plus
    // EN_ATTENTE — le job ne fait rien. C'est ce qui rend inutile la
    // suppression explicite du job lors de confirmReservation().
    if (reservation.status !== ReservationStatus.EN_ATTENTE) {
      this.logger.log(
        `Réservation ${reservationId} déjà ${reservation.status}, expiration ignorée.`,
      );
      return;
    }

    // Pause d'examen KYC (volet 2) : si la pièce d'identité de l'acheteur
    // est en cours de validation admin (kycStatus = EN_ATTENTE), on ne
    // libère PAS l'unité : le job se reporte de lui-même de 1h. Le timing
    // du job n'est jamais re-planifié à la création : on incrémente ici une
    // fenêtre courte et on redécide au prochain déclenchement. Dès que la
    // pièce n'est plus EN_ATTENTE (validée ou rejetée), le job reprend son
    // cours normal et annule la réservation — aucune unité n'est bloquée
    // indéfiniment. Si l'acheteur ne soumet jamais de pièce, kycStatus reste
    // NON_SOUMIS (≠ EN_ATTENTE) et le décompte initial de 48h s'applique.
    if (reservation.user?.kycStatus === KycStatus.EN_ATTENTE) {
      await job.moveToDelayed(Date.now() + KYC_HOLD_CHECK_MS);
      this.logger.log(
        `Réservation ${reservationId} : KYC en attente de validation admin, expiration reportée de ${KYC_HOLD_CHECK_MS / 60_000} min.`,
      );
      return;
    }

    await this.prisma.$transaction([
      this.prisma.reservation.update({
        where: { id: reservationId },
        data: { status: ReservationStatus.ANNULEE },
      }),
      this.prisma.unit.update({
        where: { id: reservation.unitId },
        data: { status: UnitStatus.DISPONIBLE },
      }),
    ]);

    await this.notifications.notifyUser(reservation.userId, {
      title: 'Réservation expirée',
      body: "Votre réservation a expiré faute d'acompte reçu dans les 48h. L'unité est de nouveau disponible.",
    });

    this.logger.log(
      `Réservation ${reservationId} expirée automatiquement, unité ${reservation.unitId} libérée.`,
    );
  }
}
