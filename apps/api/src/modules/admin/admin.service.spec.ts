import { InstallmentStatus, UnitStatus, UnitType } from '@prisma/client';
import { AdminService } from './admin.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const createMockPrisma = () => ({
  block: {
    findMany: jest.fn(),
  },
  paymentInstallment: {
    findMany: jest.fn(),
  },
});

describe('AdminService', () => {
  let service: AdminService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new AdminService(prisma as unknown as PrismaService);
  });

  it('transforme l’occupation en vue bloc → unités minimale', async () => {
    prisma.block.findMany.mockResolvedValue([
      {
        id: 'block-1',
        name: 'Bloc A',
        progressPercent: 35,
        units: [
          { id: 'unit-1', floor: 0, type: UnitType.T2, status: UnitStatus.DISPONIBLE },
          { id: 'unit-2', floor: 1, type: UnitType.T3, status: UnitStatus.VENDU },
        ],
      },
    ]);

    const result = await service.getOccupancy();

    expect(prisma.block.findMany).toHaveBeenCalledWith({
      include: { units: { orderBy: [{ floor: 'asc' }] } },
    });
    expect(result).toEqual([
      {
        blockId: 'block-1',
        blockName: 'Bloc A',
        progressPercent: 35,
        units: [
          { id: 'unit-1', floor: 0, type: UnitType.T2, status: UnitStatus.DISPONIBLE },
          { id: 'unit-2', floor: 1, type: UnitType.T3, status: UnitStatus.VENDU },
        ],
      },
    ]);
  });

  it('cherche uniquement les échéances impayées déjà échues', async () => {
    prisma.paymentInstallment.findMany.mockResolvedValue([]);

    await service.getOverduePayments();

    expect(prisma.paymentInstallment.findMany).toHaveBeenCalledWith({
      where: { status: InstallmentStatus.EN_ATTENTE, dueDate: { lt: expect.any(Date) } },
      include: { schedule: { include: { reservation: { include: { user: true } } } } },
    });
  });
});
