import { Injectable, Logger } from '@nestjs/common';
import { DocumentType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { KYC_REJECTED_RETENTION_DAYS } from './kyc-retention.constants';

/**
 * Logique métier du dossier KYC d'un acheteur (pièce d'identité).
 *
 * La purge d'une pièce rejetée est le premier bloc livré (C1). La décision de
 * rejet/validation (C3) réutilisera ce service pour centraliser les
 * transitions d'état et la planification du job de rétention.
 *
 * Source de vérité de la purge = `Document.rejectedAt` (et non le statut
 * courant du user) : une resoumission passe ensuite le user en EN_ATTENTE puis
 * éventuellement en VALIDE, mais la pièce rejetée antérieurement doit quand
 * même être épurée à échéance. Suppression de l'objet B2 PUIS de la ligne en
 * base : si la ligne bloque, un second delete d'objet est sans effet
 * (DeleteObject est idempotent sur S3/B2) — la reprise BullMQ est sûre.
 */
@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

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

    await this.storage.deleteObject(document.fileUrl);
    await this.prisma.document.delete({ where: { id: documentId } });

    this.logger.log(
      `Pièce KYC rejetée ${documentId} purgée après ${KYC_REJECTED_RETENTION_DAYS} jours (objet B2 + base).`,
    );
  }
}