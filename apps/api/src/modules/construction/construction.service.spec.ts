import { ForbiddenException } from '@nestjs/common';
import { AssignmentStatus, ConstructionPhase, LaunchStatus, UserRole } from '@prisma/client';
import { ConstructionService } from './construction.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { AuthUser } from '../auth/auth-user.interface';

const createMockPrisma = () => ({
  block: {
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  artisanAssignment: {
    findFirst: jest.fn(),
  },
  constructionUpdate: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  reservation: {
    findMany: jest.fn(),
  },
  unit: {
    findUnique: jest.fn(),
  },
});

const createMockNotifications = () => ({
  notifyUser: jest.fn(),
});

const admin: AuthUser = {
  id: 'admin-1',
  role: UserRole.ADMIN,
  email: 'admin@test.tg',
  artisanId: null,
};

const artisanWithoutAssignment: AuthUser = {
  id: 'artisan-user-1',
  role: UserRole.ARTISAN,
  artisanId: 'artisan-1',
  email: 'artisan@test.tg',
};

const updateData = {
  phase: ConstructionPhase.GROS_OEUVRE,
  progressPercent: 42,
  description: 'Fondations terminées.',
  photos: ['uploads/construction/photo-1.jpg'],
};

describe('ConstructionService', () => {
  let service: ConstructionService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let notifications: ReturnType<typeof createMockNotifications>;

  beforeEach(() => {
    prisma = createMockPrisma();
    notifications = createMockNotifications();
    service = new ConstructionService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationService,
    );
    prisma.block.update.mockResolvedValue({ id: 'block-1' });
    prisma.constructionUpdate.create.mockResolvedValue({ id: 'update-1', ...updateData });
    prisma.reservation.findMany.mockResolvedValue([]);
    notifications.notifyUser.mockResolvedValue(undefined);
  });

  it('autorise un admin à publier si le lot est en construction', async () => {
    prisma.block.findUniqueOrThrow.mockResolvedValue({
      launchStatus: LaunchStatus.EN_CONSTRUCTION,
    });

    const result = await service.publishUpdate('block-1', admin, updateData);

    expect(result).toMatchObject({ id: 'update-1' });
    expect(prisma.constructionUpdate.create).toHaveBeenCalledWith({
      data: { blockId: 'block-1', publishedById: 'admin-1', ...updateData },
    });
    expect(prisma.block.update).toHaveBeenCalledWith({
      where: { id: 'block-1' },
      data: { constructionPhase: updateData.phase, progressPercent: 42 },
    });
  });

  it('refuse un artisan sans artisanId', async () => {
    const user = { ...artisanWithoutAssignment, artisanId: null };

    await expect(service.publishUpdate('block-1', user, updateData)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.block.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(prisma.constructionUpdate.create).not.toHaveBeenCalled();
  });

  it('refuse un artisan sans affectation active sur le lot', async () => {
    prisma.artisanAssignment.findFirst.mockResolvedValue(null);

    await expect(
      service.publishUpdate('block-1', artisanWithoutAssignment, updateData),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.artisanAssignment.findFirst).toHaveBeenCalledWith({
      where: {
        blockId: 'block-1',
        artisanId: 'artisan-1',
        status: { in: [AssignmentStatus.ACCEPTEE, AssignmentStatus.EN_COURS] },
      },
    });
    expect(prisma.block.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('autorise un artisan affecté avec un statut actif', async () => {
    prisma.artisanAssignment.findFirst.mockResolvedValue({ id: 'assignment-1' });
    prisma.block.findUniqueOrThrow.mockResolvedValue({
      launchStatus: LaunchStatus.EN_CONSTRUCTION,
    });

    await service.publishUpdate('block-1', artisanWithoutAssignment, updateData);

    expect(prisma.constructionUpdate.create).toHaveBeenCalled();
  });

  it('refuse toute publication avant le statut EN_CONSTRUCTION', async () => {
    prisma.block.findUniqueOrThrow.mockResolvedValue({
      launchStatus: LaunchStatus.FINANCEMENT_EN_COURS,
    });

    await expect(service.publishUpdate('block-1', admin, updateData)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.constructionUpdate.create).not.toHaveBeenCalled();
    expect(prisma.block.update).not.toHaveBeenCalled();
  });

  it('notifie uniquement les acquéreurs confirmés ou livrés', async () => {
    prisma.block.findUniqueOrThrow.mockResolvedValue({
      launchStatus: LaunchStatus.EN_CONSTRUCTION,
    });
    prisma.reservation.findMany.mockResolvedValue([{ userId: 'buyer-1' }, { userId: 'buyer-2' }]);

    await service.publishUpdate('block-1', admin, updateData);

    expect(prisma.reservation.findMany).toHaveBeenCalledWith({
      where: { unit: { blockId: 'block-1' }, status: { in: ['CONFIRMEE', 'LIVREE'] } },
      select: { userId: true },
    });
    expect(notifications.notifyUser).toHaveBeenCalledTimes(2);
    expect(notifications.notifyUser).toHaveBeenCalledWith('buyer-1', {
      title: 'Avancement chantier',
      body: 'Votre résidence est à 42% (phase: GROS_OEUVRE).',
    });
  });
});
