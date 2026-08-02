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
