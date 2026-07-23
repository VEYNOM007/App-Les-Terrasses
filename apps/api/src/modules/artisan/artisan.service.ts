import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { AssignmentStatus, QuoteStatus } from '@prisma/client';

@Injectable()
export class ArtisanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  /**
   * Vérifie qu'un artisan a bien une affectation active (ACCEPTEE/EN_COURS)
   * sur un bloc donné. Utilisé comme garde dans toutes les méthodes qui
   * exposent des infos de chantier — c'est le cœur du modèle de sécurité
   * "Logisbox Artisans" : un artisan ne voit que ce sur quoi il est affecté.
   */
  private async assertActiveAssignment(artisanId: string, blockId: string) {
    const assignment = await this.prisma.artisanAssignment.findFirst({
      where: {
        artisanId,
        blockId,
        status: { in: [AssignmentStatus.ACCEPTEE, AssignmentStatus.EN_COURS] },
      },
    });
    if (!assignment) {
      throw new ForbiddenException("Vous n'êtes pas affecté à ce chantier.");
    }
    return assignment;
  }

  /**
   * Liste des chantiers (blocs) sur lesquels l'artisan a une affectation,
   * quel que soit le statut — c'est son tableau de bord principal.
   */
  async getMyAssignments(artisanId: string) {
    return this.prisma.artisanAssignment.findMany({
      where: { artisanId },
      include: {
        block: { include: { project: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Accepter/refuser une affectation proposée par l'admin.
   */
  async respondToAssignment(assignmentId: string, artisanId: string, accept: boolean) {
    const assignment = await this.prisma.artisanAssignment.findUnique({
      where: { id: assignmentId },
    });
    if (!assignment || assignment.artisanId !== artisanId) {
      throw new NotFoundException('Affectation introuvable.');
    }
    if (assignment.status !== AssignmentStatus.PROPOSEE) {
      throw new ForbiddenException('Cette affectation a déjà été traitée.');
    }

    return this.prisma.artisanAssignment.update({
      where: { id: assignmentId },
      data: { status: accept ? AssignmentStatus.ACCEPTEE : AssignmentStatus.ANNULEE },
    });
  }

  /**
   * Planning du chantier pour un bloc — réutilise l'historique de
   * ConstructionUpdate (même source que le suivi côté acheteur), filtré
   * par vérification d'affectation active.
   */
  async getBlockPlanning(artisanId: string, blockId: string) {
    await this.assertActiveAssignment(artisanId, blockId);

    return this.prisma.constructionUpdate.findMany({
      where: { blockId },
      orderBy: { publishedAt: 'desc' },
    });
  }

  /**
   * Coordonnées des acheteurs ayant une unité dans ce bloc — utile pour
   * coordonner un accès chantier ou une visite de finition. On ne
   * renvoie que le strict nécessaire (pas l'historique de paiement ou
   * autres données sensibles de l'acheteur).
   */
  async getBlockClientContacts(artisanId: string, blockId: string) {
    await this.assertActiveAssignment(artisanId, blockId);

    const reservations = await this.prisma.reservation.findMany({
      where: {
        unit: { blockId },
        status: { in: ['CONFIRMEE', 'LIVREE'] },
      },
      include: {
        user: { select: { fullName: true, phone: true, email: true } },
        unit: { select: { type: true, floor: true } },
      },
    });

    return reservations.map((r) => ({
      unitType: r.unit.type,
      floor: r.unit.floor,
      clientName: r.user.fullName,
      clientPhone: r.user.phone,
    }));
  }

  /**
   * Soumettre un devis pour un chantier auquel l'artisan est affecté
   * (ou en cours de proposition — on autorise aussi PROPOSEE, un devis
   * pouvant précéder l'acceptation formelle).
   */
  async submitQuote(
    artisanId: string,
    blockId: string,
    data: { amount: number; description: string; documentUrl?: string },
  ) {
    const hasAnyAssignment = await this.prisma.artisanAssignment.findFirst({
      where: { artisanId, blockId },
    });
    if (!hasAnyAssignment) {
      throw new ForbiddenException("Aucune affectation, même proposée, sur ce chantier.");
    }

    return this.prisma.quote.create({
      data: {
        artisanId,
        blockId,
        amount: data.amount,
        description: data.description,
        documentUrl: data.documentUrl,
        status: QuoteStatus.ENVOYE,
      },
    });
  }

  async getMyQuotes(artisanId: string) {
    return this.prisma.quote.findMany({
      where: { artisanId },
      include: { block: { select: { name: true, projectId: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ------------- Côté admin -------------

  async proposeAssignment(
    adminUserId: string,
    data: { artisanId: string; blockId: string; scope?: string; startDate?: Date; endDate?: Date },
  ) {
    const assignment = await this.prisma.artisanAssignment.create({
      data: {
        artisanId: data.artisanId,
        blockId: data.blockId,
        scope: data.scope,
        startDate: data.startDate,
        endDate: data.endDate,
        status: AssignmentStatus.PROPOSEE,
      },
      include: { artisan: { include: { user: true } } },
    });

    await this.notifications.notifyUser(assignment.artisan.userId, {
      title: 'Nouvelle proposition de chantier',
      body: `Vous avez été proposé pour intervenir sur le bloc ${data.blockId}.`,
    });

    return assignment;
  }

  async reviewQuote(quoteId: string, decision: 'ACCEPTE' | 'REFUSE') {
    return this.prisma.quote.update({
      where: { id: quoteId },
      data: { status: decision as QuoteStatus },
    });
  }
}
