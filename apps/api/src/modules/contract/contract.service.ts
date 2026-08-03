import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { DocumentType, UserRole } from '@prisma/client';

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
  ) {}

  async generateBuyerContract(reservationId: string, fileUrl: string, userId: string, role: UserRole) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
    });
    if (!reservation) throw new NotFoundException('Réservation introuvable.');

    // Un achat ne peut générer son contrat que sur sa propre réservation
    // (les admins peuvent le faire pour tout le monde).
    if (role !== UserRole.ADMIN && reservation.userId !== userId) {
      throw new ForbiddenException('Cette réservation ne vous appartient pas.');
    }

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
    fileUrl: string,
    userId: string,
    role: UserRole,
  ) {
    const assignment = await this.prisma.artisanAssignment.findUnique({
      where: { id: assignmentId },
      include: { artisan: true },
    });
    if (!assignment) throw new NotFoundException('Affectation introuvable.');

    // Seul l'artisan affecté (ou un admin) peut générer son contrat
    // d'intervention.
    if (role !== UserRole.ADMIN && assignment.artisan.userId !== userId) {
      throw new ForbiddenException("Cette affectation ne vous appartient pas.");
    }

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
