import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
// Clients d'envoi réels (Firebase push, provider email/SMS) à injecter
// selon l'implémentation choisie — omis ici, hors périmètre du scaffold.

@Processor('notification-dispatch')
export class NotificationDispatchProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<{ userId: string; title: string; body: string }>) {
    const prefs = await this.prisma.notificationPreference.findUnique({
      where: { userId: job.data.userId },
    });

    // if (prefs?.push !== false) await this.pushClient.send(...)
    // if (prefs?.email) await this.emailClient.send(...)
    // if (prefs?.sms) await this.smsClient.send(...)
  }
}
