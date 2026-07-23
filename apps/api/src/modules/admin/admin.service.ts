import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { InstallmentStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Vue d'occupation façon "plan de salle" : bloc -> étage -> unité -> statut.
   */
  async getOccupancy() {
    const blocks = await this.prisma.block.findMany({
      include: { units: { orderBy: [{ floor: 'asc' }] } },
    });

    return blocks.map((b) => ({
      blockId: b.id,
      blockName: b.name,
      progressPercent: b.progressPercent,
      units: b.units.map((u) => ({ id: u.id, floor: u.floor, type: u.type, status: u.status })),
    }));
  }

  async getOverduePayments() {
    return this.prisma.paymentInstallment.findMany({
      where: { status: InstallmentStatus.EN_ATTENTE, dueDate: { lt: new Date() } },
      include: { schedule: { include: { reservation: { include: { user: true } } } } },
    });
  }

  async listReservations(status?: string) {
    return this.prisma.reservation.findMany({
      where: status ? { status: status as any } : undefined,
      include: { unit: true, user: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateReservationStatus(reservationId: string, status: any) {
    return this.prisma.reservation.update({ where: { id: reservationId }, data: { status } });
  }
}
