import { Frontage, ProjectStatus, UnitStatus, UnitType } from '@prisma/client';
import { ProjectService } from './project.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateBlockDto } from './dto/create-block.dto';
import { CreateUnitDto } from './dto/create-unit.dto';

const createMockPrisma = () => ({
  project: {
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  block: {
    create: jest.fn(),
  },
  unit: {
    create: jest.fn(),
    update: jest.fn(),
  },
});

describe('ProjectService', () => {
  let service: ProjectService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new ProjectService(prisma as unknown as PrismaService);
  });

  it('mappe les champs du DTO lors de la création d’un projet', async () => {
    const data: CreateProjectDto = {
      name: 'Terrasses de Baguida',
      location: 'Lomé, Togo',
      description: 'Résidence fermée',
      amenities: ['Piscine'],
      coverImage: 'https://example.com/cover.jpg',
      siteMapImageUrl: 'https://example.com/plan.jpg',
      status: ProjectStatus.BROUILLON,
    };
    prisma.project.create.mockResolvedValue({ id: 'project-1', ...data });

    await service.createProject(data);

    expect(prisma.project.create).toHaveBeenCalledWith({ data });
  });

  it('met à jour un projet sans exposer d’autres champs', async () => {
    const data = { name: 'Nouveau nom', status: ProjectStatus.PUBLIE };
    prisma.project.update.mockResolvedValue({ id: 'project-1', ...data });

    await service.updateProject('project-1', data);

    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: {
        name: 'Nouveau nom',
        location: undefined,
        description: undefined,
        amenities: undefined,
        coverImage: undefined,
        siteMapImageUrl: undefined,
        status: ProjectStatus.PUBLIE,
      },
    });
  });

  it('convertit les points du plan de masse à la création d’un bloc', async () => {
    const data: CreateBlockDto = {
      projectId: 'project-1',
      name: 'Bloc A',
      floors: 3,
      frontage: Frontage.FACADE_PRINCIPALE,
      distanceFromEntranceM: 25,
      sitePlanPolygon: [{ x: 10, y: 20 }, { x: 30, y: 40 }],
    };
    prisma.block.create.mockResolvedValue({ id: 'block-1' });

    await service.createBlock(data);

    expect(prisma.block.create).toHaveBeenCalledWith({
      data: {
        projectId: 'project-1',
        name: 'Bloc A',
        floors: 3,
        frontage: Frontage.FACADE_PRINCIPALE,
        distanceFromEntranceM: 25,
        sitePlanPolygon: [{ x: 10, y: 20 }, { x: 30, y: 40 }],
      },
    });
  });

  it('mappe les champs métier lors de la création d’une unité', async () => {
    const data: CreateUnitDto = {
      blockId: 'block-1',
      type: UnitType.T2,
      surface: 55,
      floor: 1,
      price: 35000000,
      currency: 'XOF',
      photos: ['photo-1.jpg'],
      status: UnitStatus.DISPONIBLE,
      hasStorefront: false,
      streetFacing: true,
    };
    prisma.unit.create.mockResolvedValue({ id: 'unit-1' });

    await service.createUnit(data);

    expect(prisma.unit.create).toHaveBeenCalledWith({ data });
  });

  it('liste les projets admin avec leurs blocs, y compris les brouillons', async () => {
    prisma.project.findMany.mockResolvedValue([]);

    await service.listAllProjects();

    expect(prisma.project.findMany).toHaveBeenCalledWith({ include: { blocks: true } });
  });
});
