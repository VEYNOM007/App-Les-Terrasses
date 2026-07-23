import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { LaunchStatus, UnitStatus } from '@prisma/client';

/**
 * Pilote le cycle de vie commercial d'un lot (bloc) :
 *
 *   EN_COMMERCIALISATION --(seuil % atteint)--> SEUIL_ATTEINT
 *   SEUIL_ATTEINT --(admin déclenche dépôt dossier)--> FINANCEMENT_EN_COURS
 *   FINANCEMENT_EN_COURS --(banque confirme financement)--> EN_CONSTRUCTION
 *   EN_CONSTRUCTION --(livraison)--> LIVRE
 *
 * Le passage SEUIL_ATTEINT est automatique (déclenché à chaque vente
 * confirmée). Les étapes suivantes sont des actions manuelles admin,
 * car elles dépendent de démarches externes (banque) non automatisables.
 */
@Injectable()
export class LaunchService {
  private readonly logger = new Logger(LaunchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  /**
   * Appelé après chaque confirmation de réservation (acompte payé).
   * Recalcule le taux de remplissage du lot et fait basculer le statut
   * si le seuil configuré est franchi.
   */
  async checkFundingThreshold(blockId: string) {
    const block = await this.prisma.block.findUniqueOrThrow({
      where: { id: blockId },
      include: { units: true },
    });

    if (block.launchStatus !== LaunchStatus.EN_COMMERCIALISATION) {
      // Déjà passé le seuil ou plus loin dans le cycle, rien à faire.
      return block;
    }

    const totalUnits = block.units.length;
    const soldUnits = block.units.filter(
      (u) => u.status === UnitStatus.VENDU || u.status === UnitStatus.LIVRE,
    ).length;
    const soldPercent = totalUnits === 0 ? 0 : Math.round((soldUnits / totalUnits) * 100);

    this.logger.log(
      `Bloc ${blockId} : ${soldUnits}/${totalUnits} vendus (${soldPercent}%, seuil ${block.fundingThresholdPercent}%)`,
    );

    if (soldPercent < block.fundingThresholdPercent) {
      return block;
    }

    const updated = await this.prisma.block.update({
      where: { id: blockId },
      data: { launchStatus: LaunchStatus.SEUIL_ATTEINT, thresholdReachedAt: new Date() },
    });

    await this.notifyAdminsThresholdReached(blockId, soldPercent);

    return updated;
  }

  /**
   * Génère le dossier de financement à présenter à la banque : liste des
   * ventes engagées (montants, échéanciers, statut de paiement), total
   * pré-vendu, et taux de remplissage — la "preuve de demande solvable".
   */
  async generateFundingDossier(blockId: string) {
    const block = await this.prisma.block.findUniqueOrThrow({
      where: { id: blockId },
      include: {
        project: true,
        units: {
          include: {
            reservations: {
              where: { status: { in: ['CONFIRMEE', 'LIVREE'] } },
              include: {
                user: { select: { fullName: true, phone: true, email: true } },
                paymentSchedule: { include: { installments: true } },
              },
            },
          },
        },
      },
    });

    const soldUnits = block.units.filter((u) => u.reservations.length > 0);
    const totalPreVendu = soldUnits.reduce((sum, u) => sum + u.price.toNumber(), 0);
    const totalDejaEncaisse = soldUnits.reduce((sum, u) => {
      const schedule = u.reservations[0]?.paymentSchedule;
      const paid = schedule?.installments
        .filter((i) => i.status === 'PAYE')
        .reduce((s, i) => s + i.amount.toNumber(), 0) ?? 0;
      return sum + paid;
    }, 0);

    return {
      projectName: block.project.name,
      blockName: block.name,
      generatedAt: new Date(),
      totalUnits: block.units.length,
      soldUnits: soldUnits.length,
      fillRatePercent: Math.round((soldUnits.length / block.units.length) * 100),
      totalPreVenduAmount: totalPreVendu,
      totalDejaEncaisseAmount: totalDejaEncaisse,
      currency: soldUnits[0]?.currency ?? 'XOF',
      buyers: soldUnits.map((u) => ({
        unitType: u.type,
        floor: u.floor,
        price: u.price,
        buyerName: u.reservations[0].user.fullName,
        buyerPhone: u.reservations[0].user.phone,
        reservationStatus: u.reservations[0].status,
      })),
    };
  }

  /**
   * L'admin déclenche officiellement le dépôt du dossier auprès de la
   * banque — passe le lot en FINANCEMENT_EN_COURS.
   */
  async markFinancingSubmitted(blockId: string) {
    const block = await this.prisma.block.findUniqueOrThrow({ where: { id: blockId } });
    if (block.launchStatus !== LaunchStatus.SEUIL_ATTEINT) {
      throw new BadRequestException(
        `Le lot doit être au statut SEUIL_ATTEINT pour déposer le dossier (statut actuel: ${block.launchStatus}).`,
      );
    }
    return this.prisma.block.update({
      where: { id: blockId },
      data: { launchStatus: LaunchStatus.FINANCEMENT_EN_COURS },
    });
  }

  /**
   * La banque confirme le financement — le chantier peut démarrer.
   * C'est ce basculement qui débloque ConstructionModule pour ce bloc.
   */
  async markFinancingSecured(blockId: string) {
    const block = await this.prisma.block.findUniqueOrThrow({ where: { id: blockId } });
    if (block.launchStatus !== LaunchStatus.FINANCEMENT_EN_COURS) {
      throw new BadRequestException(
        `Le lot doit être au statut FINANCEMENT_EN_COURS pour acter le financement (statut actuel: ${block.launchStatus}).`,
      );
    }

    const updated = await this.prisma.block.update({
      where: { id: blockId },
      data: {
        launchStatus: LaunchStatus.EN_CONSTRUCTION,
        financingSecuredAt: new Date(),
        constructionStartedAt: new Date(),
      },
    });

    await this.notifyBuyersConstructionStarting(blockId);

    return updated;
  }

  async setFundingThreshold(blockId: string, percent: number) {
    if (percent < 1 || percent > 100) {
      throw new BadRequestException('Le seuil doit être compris entre 1 et 100%.');
    }
    return this.prisma.block.update({
      where: { id: blockId },
      data: { fundingThresholdPercent: percent },
    });
  }

  async getLaunchStatus(blockId: string) {
    const block = await this.prisma.block.findUniqueOrThrow({
      where: { id: blockId },
      include: { units: true },
    });
    const soldUnits = block.units.filter(
      (u) => u.status === UnitStatus.VENDU || u.status === UnitStatus.LIVRE,
    ).length;

    return {
      launchStatus: block.launchStatus,
      fundingThresholdPercent: block.fundingThresholdPercent,
      currentFillRatePercent: Math.round((soldUnits / block.units.length) * 100),
      soldUnits,
      totalUnits: block.units.length,
      thresholdReachedAt: block.thresholdReachedAt,
      financingSecuredAt: block.financingSecuredAt,
    };
  }

  private async notifyAdminsThresholdReached(blockId: string, soldPercent: number) {
    const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN' } });
    await Promise.all(
      admins.map((a) =>
        this.notifications.notifyUser(a.id, {
          title: 'Seuil de financement atteint',
          body: `Le lot ${blockId} a atteint ${soldPercent}% de ventes — dossier de financement prêt à générer.`,
        }),
      ),
    );
  }

  private async notifyBuyersConstructionStarting(blockId: string) {
    const reservations = await this.prisma.reservation.findMany({
      where: { unit: { blockId }, status: { in: ['CONFIRMEE', 'LIVREE'] } },
      select: { userId: true },
    });
    await Promise.all(
      reservations.map((r) =>
        this.notifications.notifyUser(r.userId, {
          title: 'Le financement est acté, votre chantier démarre !',
          body: 'Le lot est officiellement financé — la construction commence. Suivez son avancement dans l\'app.',
        }),
      ),
    );
  }
}
