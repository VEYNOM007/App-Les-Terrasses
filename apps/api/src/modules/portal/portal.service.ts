import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ContractSignerType, DocumentSide } from '@prisma/client';
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
        unit: {
          include: {
            block: true,
            media: { orderBy: { sortOrder: 'asc' } },
          },
        },
        paymentSchedule: { include: { installments: true } },
      },
    });

    return reservations.map((r) => ({
      reservationId: r.id,
      status: r.status,
      // Dates brutes exposées au portail : createdAt = date de réservation ;
      // updatedAt = dernière transition de statut (pour les annulées, la date
      // d'annulation). Aucune colonne dédiée `cancelledAt` n'existe en base ;
      // on ne réintroduit pas une donnée fabriquée.
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      unit: r.unit,
      constructionProgress: r.unit.block.progressPercent,
      constructionPhase: r.unit.block.constructionPhase,
      nextInstallment: r.paymentSchedule?.installments.find((i) => i.status === 'EN_ATTENTE'),
    }));
  }

  async listDocuments(userId: string) {
    const documents = await this.prisma.document.findMany({
      where: {
        OR: [
          { reservation: { userId } },
          { artisanAssignment: { artisan: { userId } } },
        ],
      },
      include: {
        reservation: { select: { id: true, status: true } },
        signatures: { select: { signerType: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return documents.map(({ reservation, signatures, ...document }) => {
      const buyerSigned = signatures.some(
        (s) => s.signerType === ContractSignerType.PROPRIETAIRE,
      );
      const adminSigned = signatures.some(
        (s) => s.signerType === ContractSignerType.ADMIN,
      );
      return {
        ...document,
        // exposition de la réservation liée (id + statut) pour que le portail
        // puisse marquer « obsolète » un contrat d'une réservation annulée ;
        // null pour les documents sans réservation (pièces artisan). Les
        // signatures sont agrégées en booléens pour que /suivi affiche le bon
        // libellé (Palier 1 : acheteur signé, promoteur en attente ; signé).
        reservationId: reservation?.id ?? null,
        reservationStatus: reservation?.status ?? null,
        buyerSigned,
        adminSigned,
      };
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

  /**
   * Dossier KYC de l'acheteur courant : son statut de vérification et la
   * dernière pièce soumise (avec motif de rejet, pour la resoumission).
   * N'expose jamais la clé de fichier B2 — la pièce se consulte via
   * GET /portal/documents/:id/download (URL signée).
   */
  async getKyc(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        kycStatus: true,
        kycDocuments: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            side: true,
            kycBatchId: true,
            createdAt: true,
            rejectedAt: true,
            rejectedReason: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    const latest = user.kycDocuments[0] ?? null;
    const toPublic = (
      doc: { id: string; name: string; createdAt: Date; rejectedAt: Date | null; rejectedReason: string | null },
    ) => ({
      id: doc.id,
      name: doc.name,
      createdAt: doc.createdAt,
      rejectedAt: doc.rejectedAt,
      rejectedReason: doc.rejectedReason,
    });

    // Verso du même lot que la face la plus récente, pour que l'acheteur
    // puisse consulter ses deux faces (recto + verso) d'une CNI / carte de
    // séjour. Ignoré si la face la plus récente est déjà le verso.
    let versoDocument: ReturnType<typeof toPublic> | null = null;
    if (latest?.kycBatchId) {
      const verso = user.kycDocuments.find(
        (d) => d.kycBatchId === latest.kycBatchId && d.side === DocumentSide.VERSO,
      );
      if (verso && verso.id !== latest.id) versoDocument = toPublic(verso);
    }

    return {
      kycStatus: user.kycStatus,
      latestDocument: latest ? toPublic(latest) : null,
      versoDocument,
    };
  }
}
