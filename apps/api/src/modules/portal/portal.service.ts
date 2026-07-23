import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class PortalService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(userId: string) {
    const reservations = await this.prisma.reservation.findMany({
      where: { userId },
      include: {
        unit: { include: { block: true } },
        paymentSchedule: { include: { installments: true } },
      },
    });

    return reservations.map((r) => ({
      reservationId: r.id,
      status: r.status,
      unit: r.unit,
      constructionProgress: r.unit.block.progressPercent,
      constructionPhase: r.unit.block.constructionPhase,
      nextInstallment: r.paymentSchedule?.installments.find((i) => i.status === 'EN_ATTENTE'),
    }));
  }

  async listDocuments(userId: string) {
    return this.prisma.document.findMany({
      where: { reservation: { userId } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
