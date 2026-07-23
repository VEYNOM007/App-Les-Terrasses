import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { UnitStatus, ReservationStatus } from '@prisma/client';

interface ExpireReservationJobData {
  reservationId: string;
}

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
