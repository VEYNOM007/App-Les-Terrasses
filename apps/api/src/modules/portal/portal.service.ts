import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';

@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async getDashboard(userId: string) {
    const reservations = await this.prisma.reservation.findMany({
      where: { userId },
      include: {
        unit: { include: { block: true } },
        paymentSchedule: { include: { installments: true } },
      },
    });

    return reservations.map((r) => ({
      reservationId: r.id,
      status: r.status,
      unit: r.unit,
      constructionProgress: r.unit.block.progressPercent,
      constructionPhase: r.unit.block.constructionPhase,
      nextInstallment: r.paymentSchedule?.installments.find((i) => i.status === 'EN_ATTENTE'),
    }));
  }

  async listDocuments(userId: string) {
    return this.prisma.document.findMany({
      where: {
        OR: [
          { reservation: { userId } },
          { artisanAssignment: { artisan: { userId } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Vérifie l'appartenance d'un document puis renvoie une URL signée à
   * durée limitée (B2) pour le télécharger. 403 si le document appartient
   * à un tiers, 404 s'il n'existe pas ou si aucune clé de fichier n'est
   * enregistrée. Le navigateur télécharge directement depuis B2 — jamais
   * de proxy serveur.
   */
  async getDocumentFile(documentId: string, userId: string): Promise<{ downloadUrl: string }> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        reservation: { select: { userId: true } },
        kycOwner: { select: { id: true } },
      },
    });

    if (!document) throw new NotFoundException('Document introuvable.');

    const ownerId = document.reservation?.userId ?? document.kycOwner?.id ?? null;
    if (ownerId !== userId) {
      throw new ForbiddenException("Ce document ne vous appartient pas.");
    }

    // Un contrat signé se télécharge dans sa version contresignée ; l'original
    // (fileUrl) reste archivé pour l'audit.
    const key = document.signedFileUrl ?? document.fileUrl;
    if (!key) throw new NotFoundException('Document sans fichier associé.');

    return { downloadUrl: await this.storage.getSignedUrl(key) };
  }
}
