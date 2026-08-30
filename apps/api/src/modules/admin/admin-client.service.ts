import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class AdminClientService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  /**
   * Liste tous les comptes inscrits — usage back-office commercial.
   */
  listUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        country: true,
        address: true,
        role: true,
        kycStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Met à jour l'adresse d'un compte utilisateur.
   */
  async updateAddress(userId: string, address: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    return this.prisma.user.update({
      where: { id: userId },
      data: { address },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        country: true,
        address: true,
        role: true,
        kycStatus: true,
        createdAt: true,
      },
    });
  }

  /**
   * Relance manuelle d'un client pour impayé : vérifie l'existence du
   * compte puis émet une notification (le dispatch push/email/SMS est
   * délégué au processor BullMQ selon les préférences du client).
   */
  async triggerRelance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true },
    });
    if (!user) throw new NotFoundException('Client introuvable.');

    return this.notifications.notifyUser(user.id, {
      title: 'Relance de paiement',
      body: `${user.fullName}, une de vos échéances est impayée — régularisez dans l'application.`,
    });
  }
}
