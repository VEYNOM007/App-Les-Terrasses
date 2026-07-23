import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';

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

  async markRead(notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
  }

  async setPreferences(userId: string, prefs: { push?: boolean; email?: boolean; sms?: boolean }) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: prefs,
      create: { userId, ...prefs },
    });
  }
}
