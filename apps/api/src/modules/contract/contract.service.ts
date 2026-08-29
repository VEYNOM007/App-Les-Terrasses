import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma, ContractSignerType, DocumentType, UserRole, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { ContractPdfService } from './contract-pdf.service';
import { StorageService } from '../../common/storage/storage.service';
import { isPng } from '../../common/files/uploads.util';

/**
 * Génère et suit les contrats — côté acheteur (contrat de réservation/vente
 * lié à une Reservation) et côté artisan (contrat d'intervention lié à une
 * ArtisanAssignment). Les deux réutilisent le modèle Document existant
   * plutôt que de dupliquer une nouvelle table, avec DocumentType.CONTRAT.
 *
 * La génération PDF elle-même (mise en page, signature électronique) est
 * déléguée à un provider externe (ex: DocuSign, ou génération PDF interne
 * + signature manuscrite scannée pour un MVP) — non détaillée ici.
 */
@Injectable()
export class ContractService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly pdf: ContractPdfService,
    private readonly storage: StorageService,
  ) {}

  async generateBuyerContract(reservationId: string, userId: string, role: UserRole) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        user: true,
        unit: { include: { block: { include: { project: true } } } },
      },
    });
    if (!reservation) throw new NotFoundException('Réservation introuvable.');

    // Un achat ne peut générer son contrat que sur sa propre réservation
    // (les admins peuvent le faire pour tout le monde).
    if (role !== UserRole.ADMIN && reservation.userId !== userId) {
      throw new ForbiddenException('Cette réservation ne vous appartient pas.');
    }

    // Garde anti-doublon (mode automatique, idempotent) : si un contrat
    // existe déjà pour cette réservation, on retourne l'existant en silence
    // — jamais on ne le recrée (cela casserait une signature en cours et
    // dupliquerait les PDF B2). Un webhook de paiement rejoué est ainsi
    // absorbé sans effet visible.
    const existing = await this.prisma.document.findFirst({
      where: { reservationId, type: DocumentType.CONTRAT },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return existing;

    const fileUrl = await this.pdf.generate({
      title: 'Contrat de réservation et de vente',
      reference: reservationId,
      sections: [
        {
          heading: 'Acquéreur',
          lines: [
            `Nom : ${reservation.user.fullName}`,
            `Email : ${reservation.user.email}`,
            `Téléphone : ${reservation.user.phone}`,
          ],
        },
        {
          heading: 'Bien réservé',
          lines: [
            `Projet : ${reservation.unit.block.project.name}`,
            `Bloc : ${reservation.unit.block.name}`,
            `Typologie : ${reservation.unit.type}`,
            `Surface : ${reservation.unit.surface} m²`,
            `Prix : ${reservation.unit.price.toString()} ${reservation.unit.currency}`,
          ],
        },
      ],
    });

    const document = await this.prisma.document.create({
      data: {
        type: DocumentType.CONTRAT,
        name: `Contrat de vente - ${reservationId}`,
        fileUrl,
        reservationId,
      },
    });

    await this.notifications.notifyUser(reservation.userId, {
      title: 'Votre contrat est disponible',
      body: 'Le contrat de vente de votre logement est prêt à consulter et signer.',
    });

    return document;
  }

  /**
   * Régénère le contrat d'une réservation à la demande d'un administrateur.
   *
   * Garde de sécurité en trois paliers selon l'état de signature actuel :
   *  - Palier 1 : le propriétaire (acheteur) a signé → BLOQUÉ, sans aucune
   *    exception, même pour un admin. On n'écrase jamais une signature
   *    acheteur ; une telle opération reste une action manuelle en base.
   *  - Palier 2 : seul l'administration a signé (sans le propriétaire) →
   *    une confirmation explicite (force=true) est requise.
   *  - Palier 3 : rien n'est signé → régénération libre (rotation du contrat
   *    non-signé : suppression de l'ancien PDF + création d'un nouveau).
   */
  async regenerateBuyerContract(reservationId: string, userId: string, role: UserRole, force = false) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { userId: true },
    });
    if (!reservation) throw new NotFoundException('Réservation introuvable.');
    if (role !== UserRole.ADMIN) {
      throw new ForbiddenException('Seul un administrateur peut régénérer un contrat.');
    }

    const existing = await this.prisma.document.findFirst({
      where: { reservationId, type: DocumentType.CONTRAT },
      include: { signatures: true },
      orderBy: { createdAt: 'desc' },
    });

    // Aucun contrat : la régénération se comporte comme une génération initiale.
    if (!existing) {
      return this.generateBuyerContract(reservationId, userId, role);
    }

    const hasOwnerSignature = existing.signatures.some(
      (s) => s.signerType === ContractSignerType.PROPRIETAIRE,
    );
    const hasAdminSignature = existing.signatures.some(
      (s) => s.signerType === ContractSignerType.ADMIN,
    );

    if (hasOwnerSignature) {
      throw new ConflictException(
        'Le contrat est déjà signé par le propriétaire : sa régénération est impossible.',
      );
    }
    if (hasAdminSignature && !force) {
      throw new ConflictException(
        'Le contrat est déjà signé par l\'administration. Confirmez la régénération pour continuer.',
      );
    }

    // Palier 3 (ou Palier 2 confirmé) : rotation de l'ancien contrat non-signé.
    await this.prisma.document.delete({ where: { id: existing.id } });
    if (existing.fileUrl) {
      await this.storage.deleteObject(existing.fileUrl);
    }

    return this.generateBuyerContract(reservationId, userId, role);
  }

  async generateArtisanContract(
    assignmentId: string,
    userId: string,
    role: UserRole,
  ) {    const assignment = await this.prisma.artisanAssignment.findUnique({
      where: { id: assignmentId },
      include: { artisan: true, block: { include: { project: true } } },
    });
    if (!assignment) throw new NotFoundException('Affectation introuvable.');

    // Seul l'artisan affecté (ou un admin) peut générer son contrat
    // d'intervention.
    if (role !== UserRole.ADMIN && assignment.artisan.userId !== userId) {
      throw new ForbiddenException("Cette affectation ne vous appartient pas.");
    }

    const fileUrl = await this.pdf.generate({
      title: "Contrat d'intervention artisan",
      reference: assignmentId,
      sections: [
        {
          heading: 'Artisan',
          lines: [
            `Entreprise : ${assignment.artisan.companyName}`,
            `Métier : ${assignment.artisan.trade}`,
          ],
        },
        {
          heading: 'Chantier',
          lines: [
            `Projet : ${assignment.block.project.name}`,
            `Bloc : ${assignment.block.name}`,
            `Périmètre : ${assignment.scope ?? 'Non précisé'}`,
            `Statut de l'affectation : ${assignment.status}`,
          ],
        },
      ],
    });

    const document = await this.prisma.document.create({
      data: {
        type: DocumentType.CONTRAT,
        name: `Contrat artisan - affectation ${assignmentId}`,
        fileUrl,
        artisanAssignmentId: assignmentId,
      },
    });

    await this.notifications.notifyUser(assignment.artisan.userId, {
      title: 'Contrat d\'intervention disponible',
      body: 'Votre contrat pour le chantier qui vous a été affecté est prêt.',
    });

    return document;
  }

  async listBuyerContracts(reservationId: string, userId: string, role: UserRole) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { userId: true },
    });
    if (!reservation) throw new NotFoundException('Réservation introuvable.');

    if (role !== UserRole.ADMIN && reservation.userId !== userId) {
      throw new ForbiddenException('Cette réservation ne vous appartient pas.');
    }

    return this.prisma.document.findMany({
      where: { reservationId, type: DocumentType.CONTRAT },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Signe un contrat. Le signataire est dérivé du JWT, jamais du client :
   * le propriétaire (acheteur ou artisan) signe en PROPRIETAIRE, un admin
   * en ADMIN. L'ordre PROPRIETAIRE puis ADMIN est imposé, et l'unicité
   * (documentId, signerType) est garantie en base — un doublon lève P2002,
   * traduit en 409. Une fois les deux signatures présentes, le PDF est
   * contresigné (signedFileUrl) et le propriétaire est notifié.
   */
  async signContract(
    documentId: string,
    userId: string,
    role: UserRole,
    signatureBuffer: Buffer,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (!isPng(signatureBuffer)) {
      throw new BadRequestException('Signature invalide : PNG requis.');
    }

    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        reservation: { select: { userId: true, status: true } },
        artisanAssignment: { include: { artisan: { select: { userId: true } } } },
        signatures: { select: { signerType: true, signatureImageUrl: true } },
      },
    });
    if (!document) throw new NotFoundException('Document introuvable.');

    // Un contrat lié à une réservation annulée est devenu obsolète : plus
    // aucune signature ne peut y être apposée (ni propriétaire ni admin).
    if (document.reservation?.status === ReservationStatus.ANNULEE) {
      throw new ConflictException('Impossible de signer un contrat d\'une réservation annulée.');
    }

    const ownerId = document.reservation?.userId ?? document.artisanAssignment?.artisan.userId ?? null;
    if (!ownerId) {
      throw new ForbiddenException("Ce document n'a pas de propriétaire signataire.");
    }

    const signerType = role === UserRole.ADMIN ? ContractSignerType.ADMIN : ContractSignerType.PROPRIETAIRE;
    if (signerType === ContractSignerType.ADMIN) {
      const ownerSigned = document.signatures.some((s) => s.signerType === ContractSignerType.PROPRIETAIRE);
      if (!ownerSigned) {
        throw new ConflictException('Le propriétaire doit signer avant l\'administration.');
      }
    } else if (ownerId !== userId) {
      throw new ForbiddenException('Seul le propriétaire du contrat peut le signer.');
    }

    // L'image n'est déposée sur B2 qu'après validation de toutes les gardes
    // (document existant, réservation non annulée, appartenance, ordre de
    // signature) : aucun objet orphelin n'est créé pour une signature rejetée.
    const signatureImageUrl = await this.persistSignature(signatureBuffer);

    try {
      await this.prisma.contractSignature.create({
        data: {
          documentId,
          signerType,
          signerUserId: userId,
          signatureImageUrl,
          ipAddress,
          userAgent,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ce contrat est déjà signé par ce signataire.');
      }
      throw error;
    }

    const signatures = await this.prisma.contractSignature.findMany({
      where: { documentId },
      select: { signerType: true, signatureImageUrl: true },
    });

    if (
      signatures.some((s) => s.signerType === ContractSignerType.PROPRIETAIRE) &&
      signatures.some((s) => s.signerType === ContractSignerType.ADMIN)
    ) {
      const ownerSignature = signatures.find((s) => s.signerType === ContractSignerType.PROPRIETAIRE);
      const adminSignature = signatures.find((s) => s.signerType === ContractSignerType.ADMIN);
      const signedFileUrl = await this.pdf.sign(document.fileUrl, [ownerSignature, adminSignature]
        .filter((s): s is NonNullable<typeof s> => s !== undefined)
        .map((s) => ({
          label: s.signerType === ContractSignerType.PROPRIETAIRE ? 'Propriétaire' : 'Administration',
          imageUrl: s.signatureImageUrl,
        })));

      await this.prisma.document.update({
        where: { id: documentId },
        data: { signedFileUrl },
      });

      await this.notifications.notifyUser(ownerId, {
        title: 'Contrat signé',
        body: 'Votre contrat est entièrement signé et disponible au téléchargement.',
      });
    }

    return this.prisma.document.findUnique({
      where: { id: documentId },
      include: { signatures: true },
    });
  }

  /** Dépose la signature PNG sur B2 sous une clé interne et renvoie la clé. */
  private async persistSignature(buffer: Buffer): Promise<string> {
    const key = `signatures/${randomUUID()}.png`;
    await this.storage.putObject(key, buffer, 'image/png');
    return key;
  }
}
