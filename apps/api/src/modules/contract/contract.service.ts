import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { DocumentType } from '@prisma/client';

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

  async generateBuyerContract(reservationId: string, fileUrl: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
    });
    if (!reservation) throw new NotFoundException('Réservation introuvable.');

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

  async generateArtisanContract(assignmentId: string, fileUrl: string) {
    const assignment = await this.prisma.artisanAssignment.findUnique({
      where: { id: assignmentId },
      include: { artisan: true },
    });
    if (!assignment) throw new NotFoundException('Affectation introuvable.');

    // Réutilise Document via kycOwnerId détourné en "owner" générique
    // serait ambigu — dans un schéma plus poussé, on ajouterait un champ
    // artisanAssignmentId dédié sur Document. Pour ce scaffold, on stocke
    // la référence dans `name` et on notifie directement.
    const document = await this.prisma.document.create({
      data: {
        type: DocumentType.CONTRAT,
        name: `Contrat artisan - affectation ${assignmentId}`,
        fileUrl,
      },
    });

    await this.notifications.notifyUser(assignment.artisan.userId, {
      title: 'Contrat d\'intervention disponible',
      body: 'Votre contrat pour le chantier qui vous a été affecté est prêt.',
    });

    return document;
  }

  async listBuyerContracts(reservationId: string) {
    return this.prisma.document.findMany({
      where: { reservationId, type: DocumentType.CONTRAT },
      orderBy: { createdAt: 'desc' },
    });
  }
}
