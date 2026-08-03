import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { DocumentType, UserRole } from '@prisma/client';
import { ContractPdfService } from './contract-pdf.service';

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

  async generateArtisanContract(
    assignmentId: string,
    userId: string,
    role: UserRole,
  ) {
    const assignment = await this.prisma.artisanAssignment.findUnique({
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
}
