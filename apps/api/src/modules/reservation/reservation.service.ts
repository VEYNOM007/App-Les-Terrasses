import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisLockService } from '../../common/redis/redis-lock.service';
import { LaunchService } from '../launch/launch.service';
import { UnitStatus, ReservationStatus } from '@prisma/client';
import { AdminReservationStatusInput } from '../admin/dto/reservation-status.dto';

const RESERVATION_HOLD_HOURS = 48;

const RESERVATION_STATUS_BY_INPUT: Record<AdminReservationStatusInput, ReservationStatus> = {
  en_attente: ReservationStatus.EN_ATTENTE,
  confirmee: ReservationStatus.CONFIRMEE,
  annulee: ReservationStatus.ANNULEE,
  livree: ReservationStatus.LIVREE,
};

@Injectable()
export class ReservationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisLock: RedisLockService,
    private readonly launchService: LaunchService,
    @InjectQueue('reservation-expiration') private readonly expirationQueue: Queue,
  ) {}

  /**
   * Cœur partagé de création de réservation : lock Redis + transaction
   * Prisma (update conditionnel `WHERE status = DISPONIBLE`). Utilisé par
   * le parcours acheteur (reserveUnit, sans offre) et par le parcours
   * admin (adminCreateReservation, avec offre personnalisée éventuelle).
   */
  private async createReservationCore(
    unitId: string,
    userId: string,
    offer?: { offerPrice?: number; offerLabel?: string },
  ) {
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
            offerPrice: offer?.offerPrice,
            offerLabel: offer?.offerLabel,
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
   * Crée une réservation pour une unité, en garantissant qu'une seule
   * réservation active ne peut exister par unité à un instant T.
   */
  async reserveUnit(unitId: string, userId: string) {
    return this.createReservationCore(unitId, userId);
  }

  /**
   * Vente commerciale enregistrée par un admin (`POST /admin/reservations`).
   * Réutilise le même mécanisme anti-double-vente que le parcours acheteur
   * (lock Redis + transaction), sans chemin de paiement parallèle.
   *
   * Règles d'offre : `offerPrice` doit être strictement positif et ne peut
   * pas dépasser le prix catalogue `unit.price` — le prix public reste
   * immuable, l'écart (s'il existe) est volontairement visible dans le
   * dossier de financement. L'échéancier est ensuite généré sur
   * `offerPrice ?? unit.price` par PaymentService.generateSchedule().
   */
  async adminCreateReservation(input: {
    unitId: string;
    userId: string;
    offerPrice?: number;
    offerLabel?: string;
  }) {
    const unit = await this.prisma.unit.findUnique({ where: { id: input.unitId } });
    if (!unit) throw new NotFoundException('Unité introuvable.');

    if (input.offerPrice !== undefined) {
      if (input.offerPrice <= 0) {
        throw new BadRequestException('offerPrice doit être un montant strictement positif.');
      }
      if (input.offerPrice > unit.price.toNumber()) {
        throw new BadRequestException(
          "offerPrice ne peut pas dépasser le prix catalogue de l'unité.",
        );
      }
    }

    return this.createReservationCore(input.unitId, input.userId, {
      offerPrice: input.offerPrice,
      offerLabel: input.offerLabel,
    });
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

  /**
   * Détail d'une réservation — réservé à son propriétaire. 404 si
   * inexistante, 403 si elle appartient à un autre utilisateur.
   */
  async findOne(reservationId: string, userId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        unit: { include: { block: true } },
        paymentSchedule: { include: { installments: true } },
      },
    });

    if (!reservation) throw new NotFoundException('Réservation introuvable.');
    if (reservation.userId !== userId) {
      throw new ForbiddenException('Cette réservation ne vous appartient pas.');
    }

    return reservation;
  }

  // ------------- Côté admin -------------

  /**
   * Liste toutes les réservations (filtre statut optionnel) avec les
   * coordonnées de l'acheteur — usage back-office commercial.
   */
  async adminList(status?: AdminReservationStatusInput) {
    return this.prisma.reservation.findMany({
      where: status ? { status: RESERVATION_STATUS_BY_INPUT[status] } : undefined,
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true } },
        unit: { select: { id: true, blockId: true, type: true, floor: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Changement manuel de statut (vente commerciale hors app, livraison…).
   * Prépare le même invariant que `confirmReservation()` :
   *  - CONFIRMEE  -> unité VENDU + recalcul du seuil de financement du lot
   *  - ANNULEE    -> unité de nouveau DISPONIBLE
   *  - les autres transitions ne touchent que la réservation.
   */
  async adminSetStatus(reservationId: string, status: AdminReservationStatusInput) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
    });
    if (!reservation) throw new NotFoundException('Réservation introuvable.');

    const target = RESERVATION_STATUS_BY_INPUT[status];
    if (reservation.status === target) return reservation;

    if (target === ReservationStatus.CONFIRMEE) {
      const [updated] = await this.prisma.$transaction([
        this.prisma.reservation.update({ where: { id: reservationId }, data: { status: target } }),
        this.prisma.unit.update({ where: { id: reservation.unitId }, data: { status: UnitStatus.VENDU } }),
      ]);

      const unit = await this.prisma.unit.findUniqueOrThrow({ where: { id: reservation.unitId } });
      await this.launchService.checkFundingThreshold(unit.blockId);

      return updated;
    }

    if (target === ReservationStatus.ANNULEE) {
      const [updated] = await this.prisma.$transaction([
        this.prisma.reservation.update({ where: { id: reservationId }, data: { status: target } }),
        this.prisma.unit.update({ where: { id: reservation.unitId }, data: { status: UnitStatus.DISPONIBLE } }),
      ]);
      return updated;
    }

    return this.prisma.reservation.update({ where: { id: reservationId }, data: { status: target } });
  }
}
