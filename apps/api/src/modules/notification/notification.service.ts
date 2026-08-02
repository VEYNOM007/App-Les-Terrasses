import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface NotificationPreferencesDto {
  push?: boolean;
  email?: boolean;
  sms?: boolean;
}

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('notification-dispatch') private readonly dispatchQueue: Queue,
  ) {}

  /**
   * Enregistre la notification en base (pour l'historique in-app) et
   * pousse un job BullMQ qui se charge de l'envoi effectif (push/email/SMS)
   * selon les préférences utilisateur — découplé pour ne jamais bloquer
   * la requête HTTP appelante sur un appel réseau externe.
   */
  async notifyUser(userId: string, payload: { title: string; body: string }) {
    const notification = await this.prisma.notification.create({
      data: { userId, ...payload },
    });

    await this.dispatchQueue.add('dispatch', { notificationId: notification.id, userId, ...payload });

    return notification;
  }

  async listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Marque une notification comme lue — uniquement si elle appartient au
   * user appelant. `updateMany` borne la cible à {id, userId} : si aucune
   * ligne n'est affectée, la notification n'existe pas ou n'est pas au user.
   */
  async markRead(notificationId: string, userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });

    if (result.count === 0) {
      throw new NotFoundException('Notification introuvable.');
    }

    return this.prisma.notification.findUnique({ where: { id: notificationId } });
  }

  async setPreferences(userId: string, prefs: NotificationPreferencesDto) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: prefs,
      create: { userId, ...prefs },
    });
  }
}
