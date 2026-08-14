import {
  Frontage,
  MediaType,
  ProjectStatus,
  UnitStatus,
  UnitType,
} from '@prisma/client';
import { ProjectService } from './project.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateBlockDto } from './dto/create-block.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { CreateUnitMediaDto } from './dto/unit-media.dto';

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
  unitMedia: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
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

  it('liste les projets admin avec leurs blocs, unités et médias, y compris les brouillons', async () => {
    prisma.project.findMany.mockResolvedValue([]);

    await service.listAllProjects();

    expect(prisma.project.findMany).toHaveBeenCalledWith({
      include: {
        blocks: {
          orderBy: { name: 'asc' },
          include: {
            units: {
              orderBy: [{ floor: 'asc' }, { type: 'asc' }],
              include: { media: { orderBy: { sortOrder: 'asc' } } },
            },
          },
        },
      },
    });
  });

  describe('médias d’unité (admin)', () => {
    it('ajoute un média à une unité en appliquant le sortOrder par défaut 0', async () => {
      const data: CreateUnitMediaDto = {
        type: MediaType.RENDU_3D,
        url: 'https://cdn.example.com/3d.png',
        altText: 'Vue d\'artiste',
      };
      prisma.unitMedia.create.mockResolvedValue({ id: 'media-1', ...data, sortOrder: 0 });

      const result = await service.addMedia('unit-1', data);

      expect(prisma.unitMedia.create).toHaveBeenCalledWith({
        data: {
          unitId: 'unit-1',
          type: MediaType.RENDU_3D,
          url: 'https://cdn.example.com/3d.png',
          altText: 'Vue d\'artiste',
          sortOrder: 0,
        },
      });
      expect(result.sortOrder).toBe(0);
    });

    it('ajoute un média en respectant un sortOrder explicite', async () => {
      const data: CreateUnitMediaDto = {
        type: MediaType.PHOTO,
        url: 'https://cdn.example.com/photo.jpg',
        sortOrder: 7,
      };
      prisma.unitMedia.create.mockResolvedValue({ id: 'media-2', ...data });

      await service.addMedia('unit-1', data);

      expect(prisma.unitMedia.create).toHaveBeenCalledWith({
        data: {
          unitId: 'unit-1',
          type: MediaType.PHOTO,
          url: 'https://cdn.example.com/photo.jpg',
          altText: undefined,
          sortOrder: 7,
        },
      });
    });

    it('met à jour partiellement un média', async () => {
      prisma.unitMedia.update.mockResolvedValue({
        id: 'media-1',
        type: MediaType.PLAN,
        url: 'https://cdn.example.com/plan-new.png',
        altText: 'Plan à jour',
        sortOrder: 2,
      });

      const result = await service.updateMedia('media-1', { altText: 'Plan à jour' });

      expect(prisma.unitMedia.update).toHaveBeenCalledWith({
        where: { id: 'media-1' },
        data: {
          type: undefined,
          url: undefined,
          altText: 'Plan à jour',
          sortOrder: undefined,
        },
      });
      expect(result.altText).toBe('Plan à jour');
    });

    it('supprime un média existant', async () => {
      prisma.unitMedia.delete.mockResolvedValue({ id: 'media-1' });

      const result = await service.removeMedia('media-1');

      expect(prisma.unitMedia.delete).toHaveBeenCalledWith({ where: { id: 'media-1' } });
      expect(result).toEqual({ id: 'media-1' });
    });

    it('remonte une 404 quand le média à supprimer n\'existe pas', async () => {
      prisma.unitMedia.delete.mockRejectedValue(new Error('P2025: Record not found'));

      await expect(service.removeMedia('media-inconnue')).rejects.toThrow(
        'Média introuvable.',
      );
    });
  });
});
