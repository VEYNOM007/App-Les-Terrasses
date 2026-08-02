import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { resolveUploadFilePath } from '../../common/files/uploads.util';

@Injectable()
export class PortalService {
  constructor(private readonly prisma: PrismaService) {}

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
      where: { reservation: { userId } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Localise le fichier d'un document et vérifie qu'il appartient au user
   * (via la réservation liée OU le propriétaire KYC). 403 si le document
   * appartient à un tiers, 404 s'il n'existe pas ou si le fichier a été
   * supprimé du disque.
   */
  async getDocumentFile(documentId: string, userId: string) {
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

    return resolveUploadFilePath(document.fileUrl);
  }
}
