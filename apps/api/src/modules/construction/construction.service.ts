import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { ConstructionPhase, LaunchStatus } from '@prisma/client';

@Injectable()
export class ConstructionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async publishUpdate(
    blockId: string,
    publishedById: string,
    data: { phase: ConstructionPhase; progressPercent: number; description?: string; photos: string[] },
  ) {
    const block = await this.prisma.block.findUniqueOrThrow({ where: { id: blockId } });
    if (block.launchStatus !== LaunchStatus.EN_CONSTRUCTION) {
      throw new ForbiddenException(
        `Ce lot n'est pas encore en construction (statut actuel: ${block.launchStatus}). ` +
          'Le financement doit être acté avant toute mise à jour chantier.',
      );
    }

    const update = await this.prisma.constructionUpdate.create({
      data: { blockId, publishedById, ...data },
    });

    // Dénormalisation : le bloc reflète toujours son dernier avancement
    // pour un affichage catalogue sans jointure supplémentaire.
    await this.prisma.block.update({
      where: { id: blockId },
      data: { constructionPhase: data.phase, progressPercent: data.progressPercent },
    });

    await this.notifyBuyers(blockId, data.phase, data.progressPercent);

    return update;
  }

  async getBlockUpdates(blockId: string) {
    return this.prisma.constructionUpdate.findMany({
      where: { blockId },
      orderBy: { publishedAt: 'desc' },
    });
  }

  async getUnitProgress(unitId: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      include: { block: true },
    });
    return {
      phase: unit?.block.constructionPhase,
      progressPercent: unit?.block.progressPercent,
    };
  }

  private async notifyBuyers(blockId: string, phase: ConstructionPhase, progressPercent: number) {
    const buyers = await this.prisma.reservation.findMany({
      where: { unit: { blockId }, status: { in: ['CONFIRMEE', 'LIVREE'] } },
      select: { userId: true },
    });

    await Promise.all(
      buyers.map((b) =>
        this.notifications.notifyUser(b.userId, {
          title: 'Avancement chantier',
          body: `Votre résidence est à ${progressPercent}% (phase: ${phase}).`,
        }),
      ),
    );
  }
}
