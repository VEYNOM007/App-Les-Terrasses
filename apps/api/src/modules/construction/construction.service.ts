import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { AuthUser } from '../auth/auth-user.interface';
import { AssignmentStatus, ConstructionPhase, LaunchStatus, UserRole } from '@prisma/client';

export interface PublishConstructionUpdateDto {
  phase: ConstructionPhase;
  progressPercent: number;
  description?: string;
  photos: string[];
}

@Injectable()
export class ConstructionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async publishUpdate(
    blockId: string,
    user: AuthUser,
    data: PublishConstructionUpdateDto,
  ) {
    await this.assertCanPublishUpdate(blockId, user);

    const block = await this.prisma.block.findUniqueOrThrow({ where: { id: blockId } });
    if (block.launchStatus !== LaunchStatus.EN_CONSTRUCTION) {
      throw new ForbiddenException(
        `Ce lot n'est pas encore en construction (statut actuel: ${block.launchStatus}). ` +
          'Le financement doit être acté avant toute mise à jour chantier.',
      );
    }

    const update = await this.prisma.constructionUpdate.create({
      data: { blockId, publishedById: user.id, ...data },
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

  /**
   * Une mise à jour chantier est une écriture sensible : réservée à un
   * admin OU à un artisan ayant une affectation active (ACCEPTEE/EN_COURS)
   * sur ce bloc. On vérifie toujours l'ArtisanAssignment, jamais le seul
   * champ `role` (règle CLAUDE.md § sécurité des rôles).
   */
  private async assertCanPublishUpdate(blockId: string, user: AuthUser) {
    if (user.role === UserRole.ADMIN) return;

    if (!user.artisanId) {
      throw new ForbiddenException(
        'Seuls un admin ou un artisan affecté au lot peuvent publier un avancement chantier.',
      );
    }

    const activeAssignment = await this.prisma.artisanAssignment.findFirst({
      where: {
        blockId,
        artisanId: user.artisanId,
        status: { in: [AssignmentStatus.ACCEPTEE, AssignmentStatus.EN_COURS] },
      },
    });

    if (!activeAssignment) {
      throw new ForbiddenException(
        'Seuls un admin ou un artisan affecté au lot peuvent publier un avancement chantier.',
      );
    }
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
