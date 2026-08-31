import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DocumentSide, DocumentType, KycStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { NotificationService } from '../notification/notification.service';
import {
  KYC_REJECTED_RETENTION_DAYS,
  KYC_REJECTED_RETENTION_MS,
} from './kyc-retention.constants';

type KycDocument = {
  id: string;
  type: DocumentType;
  fileUrl: string;
  kycOwnerId: string | null;
  kycBatchId: string | null;
  side?: DocumentSide | null;
  rejectedAt: Date | null;
};

/**
 * Logique métier du dossier KYC d'un acheteur (pièce d'identité).
 *
 * Transitions d'état : rejet (REJETE + rejectedAt/rejectedReason + job de
 * purge à 15 j) et validation (VALIDE). Un ADMIN ne peut traiter QUE la
 * pièce la plus récente du user (`ensureIsLatestKycBatch`) : une vieille
 * pièce rejetée n'est jamais ré-activable, et une resoumission rend le
 * traitement précédent obsolète (409).
 *
 * Purge (job différé `kyc-document-retention`, délai 15 j) : source de
 * vérité = `Document.rejectedAt` (et non le statut courant du user) — une
 * resoumission suivi de validation n'empêche pas l'épuration de la pièce
 * rejetée antérieurement. Suppression objet B2 PUIS ligne base : un échec
 * laisse une ligne resoumise au retry BullMQ (DeleteObject est idempotent).
 */
@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationService,
    @InjectQueue('kyc-document-retention')
    private readonly retentionQueue: Queue,
  ) {}

  // ──────────────────────────────────────────────────
  // Purge à 15 jours (C1)
  // ──────────────────────────────────────────────────

  async purgeRejectedDocument(documentId: string): Promise<void> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      this.logger.warn(`Document ${documentId} introuvable, purge ignorée.`);
      return;
    }

    if (document.type !== DocumentType.PIECE_IDENTITE || !document.kycOwnerId) {
      this.logger.warn(`Document ${documentId} n'est pas une pièce KYC, purge ignorée.`);
      return;
    }

    if (!document.rejectedAt) {
      this.logger.log(`Document ${documentId} non rejeté, purge ignorée.`);
      return;
    }

    // Purge du LOT complet : une pièce à 2 faces (recto + verso) partage le
    // même `kycBatchId`. On supprime l'objet B2 PUIS la ligne base pour
    // chaque face — un échec laisse une ligne resoumise au retry BullMQ
    // (DeleteObject est idempotent).
    const batchIds = document.kycBatchId ? { kycBatchId: document.kycBatchId } : { id: documentId };
    const faces = await this.prisma.document.findMany({
      where: { ...batchIds, type: DocumentType.PIECE_IDENTITE, kycOwnerId: document.kycOwnerId },
    });

    for (const face of faces) {
      await this.storage.deleteObject(face.fileUrl);
      await this.prisma.document.delete({ where: { id: face.id } });
    }

    this.logger.log(
      `Pièce KYC rejetée ${documentId} purgée après ${KYC_REJECTED_RETENTION_DAYS} jours (${faces.length} face(s), objets B2 + base).`,
    );
  }

  // ──────────────────────────────────────────────────
  // Revue ADMIN
  // ──────────────────────────────────────────────────

  /**
   * Liste des dossiers KYC ouverts (statut != NON_SOUMIS), triés par date de
   * dernière activité. Pour chaque user : la pièce la plus récente (active)
   * et le nombre total de pièces. Un même user peut avoir un historique de
   * pièces rejetées : seule la plus récente est actionnable.
   */
  async listAdminKyc() {
    const users = await this.prisma.user.findMany({
      where: { kycStatus: { not: KycStatus.NON_SOUMIS } },
      select: {
        id: true,
        fullName: true,
        email: true,
        kycStatus: true,
        updatedAt: true,
        kycDocuments: {
          where: { type: DocumentType.PIECE_IDENTITE },
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
      orderBy: { updatedAt: 'desc' },
    });

    return users.map(({ kycDocuments, ...user }) => {
      const latest = kycDocuments[0] ?? null;
      const toPublic = (
        doc: { id: string; name: string; createdAt: Date; rejectedAt: Date | null; rejectedReason: string | null },
      ) => ({
        id: doc.id,
        name: doc.name,
        createdAt: doc.createdAt,
        rejectedAt: doc.rejectedAt,
        rejectedReason: doc.rejectedReason,
      });

      let versoDocument: ReturnType<typeof toPublic> | null = null;
      if (latest?.kycBatchId) {
        const verso = kycDocuments.find(
          (d) => d.kycBatchId === latest.kycBatchId && d.side === DocumentSide.VERSO,
        );
        if (verso) versoDocument = toPublic(verso);
      }

      return {
        ...user,
        latestDocument: latest ? toPublic(latest) : null,
        versoDocument,
        documentCount: kycDocuments.length,
      };
    });
  }

  /**
   * URL signée (TTL B2, 15 min par défaut) pour la consultation d'une pièce.
   * L'ADMIN télécharge directement depuis B2 — jamais de proxy serveur.
   */
  async getDocumentSignedUrl(documentId: string): Promise<{ url: string }> {
    const document = await this.getKycDocumentOrThrow(documentId);
    return { url: await this.storage.getSignedUrl(document.fileUrl) };
  }

  /** Valide la pièce la plus récente : le user passe en `VALIDE`. */
  async approve(documentId: string): Promise<{ documentId: string; kycStatus: KycStatus }> {
    const document = await this.getKycDocumentOrThrow(documentId);

    if (document.rejectedAt) {
      throw new ConflictException('Document déjà rejeté : validation impossible.');
    }
    await this.ensureIsLatestKycBatch(document);

    await this.prisma.user.update({
      where: { id: document.kycOwnerId! },
      data: { kycStatus: KycStatus.VALIDE },
    });

    await this.notifications.notifyUser(document.kycOwnerId!, {
      title: 'Vérification d\'identité validée',
      body: 'Votre pièce d\'identité a été validée. Vous pouvez maintenant signer votre contrat.',
    });

    this.logger.log(`Pièce KYC ${documentId} validée pour ${document.kycOwnerId}.`);
    return { documentId, kycStatus: KycStatus.VALIDE };
  }

  /**
   * Rejette la pièce la plus récente : motif OBLIGATOIRE, user en `REJETE`,
   * échéance de purge (job BullMQ différé, 15 j) et notification du motif à
   * l'acheteur pour qu'il soumette une nouvelle pièce.
   */
  async reject(
    documentId: string,
    reason: string,
  ): Promise<{ documentId: string; kycStatus: KycStatus }> {
    const trimmedReason = reason?.trim() ?? '';
    if (!trimmedReason) {
      throw new BadRequestException('Le motif de rejet est obligatoire.');
    }

    const document = await this.getKycDocumentOrThrow(documentId);

    if (document.rejectedAt) {
      throw new ConflictException('Ce document est déjà rejeté.');
    }
    await this.ensureIsLatestKycBatch(document);

    // Rejet du LOT complet : toutes les faces d'une même pièce (recto +
    // verso) sont marquées rejetées ensemble et purgées ensemble à 15 jours.
    const faces = await this.getKycBatchFaces(document);

    await this.prisma.$transaction([
      this.prisma.document.updateMany({
        where: { id: { in: faces.map((f) => f.id) } },
        data: { rejectedAt: new Date(), rejectedReason: trimmedReason },
      }),
      this.prisma.user.update({
        where: { id: document.kycOwnerId! },
        data: { kycStatus: KycStatus.REJETE },
      }),
    ]);

    await this.retentionQueue.add(
      'retain-document',
      { documentId },
      { delay: KYC_REJECTED_RETENTION_MS, jobId: documentId },
    );

    await this.notifications.notifyUser(document.kycOwnerId!, {
      title: 'Vérification d\'identité rejetée',
      body: `Votre pièce d'identité a été rejetée pour le motif suivant : ${trimmedReason}. Vous pouvez en soumettre une nouvelle.`,
    });

    this.logger.log(`Pièce KYC ${documentId} rejetée pour ${document.kycOwnerId}, purge planifiée à ${KYC_REJECTED_RETENTION_DAYS} jours.`);
    return { documentId, kycStatus: KycStatus.REJETE };
  }

  // ──────────────────────────────────────────────────
  // Gardes privées
  // ──────────────────────────────────────────────────

  private async getKycDocumentOrThrow(documentId: string): Promise<KycDocument> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document || document.type !== DocumentType.PIECE_IDENTITE || !document.kycOwnerId) {
      throw new NotFoundException('Pièce d\'identité introuvable.');
    }
    return document;
  }

  /**
   * Seul le lot le plus récent d'un user est actionnable. Un lot rejeté puis
   * dépassé par une resoumission devient inerte (ex : on ne peut pas
   * re-valider l'ancien lot rejeté, ni le re-rejeter). Le lot = les faces
   * partageant le même `kycBatchId` que le document passé.
   */
  private async ensureIsLatestKycBatch(document: KycDocument): Promise<void> {
    const latest = await this.prisma.document.findFirst({
      where: { kycOwnerId: document.kycOwnerId!, type: DocumentType.PIECE_IDENTITE },
      orderBy: { createdAt: 'desc' },
    });

    const latestBatchId = latest?.kycBatchId ?? latest?.id ?? null;
    const currentBatchId = document.kycBatchId ?? document.id;

    if (!latest || latestBatchId !== currentBatchId) {
      throw new ConflictException(
        'Un lot plus récent a été soumis : ce document n\'est plus actionnable.',
      );
    }
  }

  /**
   * Toutes les faces du même lot que `document`. Pour les données antérieures
   * à la migration (sans `kycBatchId`), se limite au document lui-même.
   */
  private async getKycBatchFaces(document: KycDocument): Promise<KycDocument[]> {
    if (!document.kycBatchId) return [document];
    return this.prisma.document.findMany({
      where: { kycBatchId: document.kycBatchId, type: DocumentType.PIECE_IDENTITE },
    });
  }
}