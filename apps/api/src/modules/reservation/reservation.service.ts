import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisLockService } from '../../common/redis/redis-lock.service';
import { LaunchService } from '../launch/launch.service';
import { UnitStatus, ReservationStatus } from '@prisma/client';

const RESERVATION_HOLD_HOURS = 48;

@Injectable()
export class ReservationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisLock: RedisLockService,
    private readonly launchService: LaunchService,
    @InjectQueue('reservation-expiration') private readonly expirationQueue: Queue,
  ) {}

  /**
   * Crée une réservation pour une unité, en garantissant qu'une seule
   * réservation active ne peut exister par unité à un instant T.
   *
   * Étape 1 (Redis) : lock court pour éviter que deux requêtes HTTP
   *   concurrentes n'entrent toutes les deux dans la transaction Prisma
   *   au même instant (fenêtre de quelques millisecondes).
   * Étape 2 (Postgres) : la transaction Prisma est la source de vérité —
   *   même sans le lock Redis (ex: Redis down), l'update conditionnel
   *   `WHERE status = DISPONIBLE` empêche la double-réservation grâce à
   *   l'atomicité de la transaction SQL.
   */
  async reserveUnit(unitId: string, userId: string) {
    const lockKey = this.redisLock.lockKeyForUnit(unitId);
    const token = await this.redisLock.acquire(lockKey, 10_000);

    if (!token) {
      // Quelqu'un d'autre est en train de réserver cette unité au même
      // instant — on ne tente pas d'attendre, on renvoie une erreur claire.
      throw new ConflictException(
        'Cette unité est en cours de réservation par un autre utilisateur, réessayez dans quelques secondes.',
      );
    }

    try {
      const reservation = await this.prisma.$transaction(async (tx) => {
        // updateMany avec condition sur status = DISPONIBLE : si une autre
        // transaction a déjà changé le statut entre-temps (cas Redis down),
        // count sera 0 et on échoue proprement au lieu de créer un doublon.
        const updateResult = await tx.unit.updateMany({
          where: { id: unitId, status: UnitStatus.DISPONIBLE },
          data: { status: UnitStatus.RESERVE },
        });

        if (updateResult.count === 0) {
          throw new ConflictException('Cette unité n\'est plus disponible.');
        }

        const lockExpiresAt = new Date(
          Date.now() + RESERVATION_HOLD_HOURS * 60 * 60 * 1000,
        );

        const newReservation = await tx.reservation.create({
          data: {
            unitId,
            userId,
            status: ReservationStatus.EN_ATTENTE,
            lockExpiresAt,
          },
        });

        return newReservation;
      });

      // Job différé : si toujours EN_ATTENTE dans 48h, on libère l'unité.
      await this.expirationQueue.add(
        'expire-reservation',
        { reservationId: reservation.id },
        { delay: RESERVATION_HOLD_HOURS * 60 * 60 * 1000, jobId: reservation.id },
      );

      return reservation;
    } finally {
      // On libère toujours le lock Redis, succès ou échec.
      await this.redisLock.release(lockKey, token);
    }
  }

  /**
   * Confirme une réservation suite à réception de l'acompte
   * (appelé depuis le PaymentModule après webhook provider).
   */
  async confirmReservation(reservationId: string) {
    const reservation = await this.prisma.$transaction(async (tx) => {
      const res = await tx.reservation.update({
        where: { id: reservationId },
        data: { status: ReservationStatus.CONFIRMEE },
      });

      await tx.unit.update({
        where: { id: res.unitId },
        data: { status: UnitStatus.VENDU },
      });

      return res;
    });

    // Recalcule le taux de remplissage du lot et fait basculer son statut
    // (EN_COMMERCIALISATION -> SEUIL_ATTEINT) si le seuil configuré est
    // franchi. Fait hors transaction : ce n'est pas critique que ça
    // échoue isolément, la vente elle-même est déjà actée.
    const unit = await this.prisma.unit.findUniqueOrThrow({ where: { id: reservation.unitId } });
    await this.launchService.checkFundingThreshold(unit.blockId);

    return reservation;
  }

  /**
   * Annulation volontaire par l'acheteur (avant confirmation uniquement).
   */
  async cancelReservation(reservationId: string, userId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) throw new NotFoundException('Réservation introuvable.');
    if (reservation.userId !== userId) {
      throw new ForbiddenException('Cette réservation ne vous appartient pas.');
    }
    if (reservation.status !== ReservationStatus.EN_ATTENTE) {
      throw new ConflictException(
        'Seule une réservation en attente peut être annulée directement.',
      );
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
  }

  async findByUser(userId: string) {
    return this.prisma.reservation.findMany({
      where: { userId },
      include: { unit: true, paymentSchedule: { include: { installments: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
