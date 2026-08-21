import {
  Frontage,
  MediaType,
  ProjectStatus,
  UnitStatus,
  UnitType,
} from '@prisma/client';
import { ProjectService } from './project.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateBlockDto } from './dto/create-block.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { CreateUnitMediaDto, UploadUnitMediaDto } from './dto/unit-media.dto';

const createMockPrisma = () => ({
  project: {
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
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
    findUnique: jest.fn(),
  },
});

/** Mock du stockage : clés internes `unit-media/…` pour le bucket public. */
const PUBLIC_URL_PREFIX = 'https://public.b2.example.com/';

const createMockStorage = () => ({
  putObjectPublic: jest.fn().mockResolvedValue(undefined),
  getPublicUrl: jest.fn((key: string) => `${PUBLIC_URL_PREFIX}${key}`),
  deleteObjectPublic: jest.fn().mockResolvedValue(undefined),
  extractKeyFromPublicUrl: jest.fn((url: string) =>
    url.startsWith(PUBLIC_URL_PREFIX) ? url.slice(PUBLIC_URL_PREFIX.length) : null,
  ),
});

describe('ProjectService', () => {
  let service: ProjectService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let storage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    prisma = createMockPrisma();
    storage = createMockStorage();
    service = new ProjectService(
      prisma as unknown as PrismaService,
      storage as unknown as StorageService,
    );
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

    it('supprime un média existant puis purge le blob du bucket public', async () => {
      prisma.unitMedia.findUnique.mockResolvedValue({
        id: 'media-1',
        url: `${PUBLIC_URL_PREFIX}unit-media/abc-123.png`,
      });
      prisma.unitMedia.delete.mockResolvedValue({ id: 'media-1' });

      const result = await service.removeMedia('media-1');

      expect(prisma.unitMedia.findUnique).toHaveBeenCalledWith({ where: { id: 'media-1' } });
      expect(prisma.unitMedia.delete).toHaveBeenCalledWith({ where: { id: 'media-1' } });
      expect(storage.extractKeyFromPublicUrl).toHaveBeenCalledWith(
        `${PUBLIC_URL_PREFIX}unit-media/abc-123.png`,
      );
      expect(storage.deleteObjectPublic).toHaveBeenCalledWith('unit-media/abc-123.png');
      expect(result).toEqual({
        id: 'media-1',
        url: `${PUBLIC_URL_PREFIX}unit-media/abc-123.png`,
      });
    });

    it('ne purge rien pour une URL externe collée par l’admin (rien à supprimer côté B2)', async () => {
      prisma.unitMedia.findUnique.mockResolvedValue({
        id: 'media-2',
        url: 'https://cdn.example.com/photo.jpg',
      });
      prisma.unitMedia.delete.mockResolvedValue({ id: 'media-2' });

      await service.removeMedia('media-2');

      expect(prisma.unitMedia.delete).toHaveBeenCalledWith({ where: { id: 'media-2' } });
      expect(storage.deleteObjectPublic).not.toHaveBeenCalled();
    });

    it('supprime quand même en base si la purge B2 échoue (best-effort, jamais bloquant)', async () => {
      prisma.unitMedia.findUnique.mockResolvedValue({
        id: 'media-3',
        url: `${PUBLIC_URL_PREFIX}unit-media/abc-456.png`,
      });
      prisma.unitMedia.delete.mockResolvedValue({ id: 'media-3' });
      storage.deleteObjectPublic.mockRejectedValue(new Error('b2 temporairement indisponible'));

      const result = await service.removeMedia('media-3');

      expect(prisma.unitMedia.delete).toHaveBeenCalledWith({ where: { id: 'media-3' } });
      expect(storage.deleteObjectPublic).toHaveBeenCalledWith('unit-media/abc-456.png');
      expect(result).toEqual({
        id: 'media-3',
        url: `${PUBLIC_URL_PREFIX}unit-media/abc-456.png`,
      });
    });

    it('remonte une 404 quand le média à supprimer n\'existe pas', async () => {
      prisma.unitMedia.findUnique.mockResolvedValue(null);

      await expect(service.removeMedia('media-inconnue')).rejects.toThrow(
        'Média introuvable.',
      );
      expect(prisma.unitMedia.delete).not.toHaveBeenCalled();
    });

    it('uploade un fichier vers le bucket public et crée l’entrée avec l’URL stable', async () => {
      const data: UploadUnitMediaDto = { type: MediaType.RENDU_3D, altText: 'Vue artiste' };
      const file = {
        fieldname: 'file',
        originalname: 'rendu-client.png',
        encoding: '7bit',
        mimetype: 'image/png',
        buffer: Buffer.from('render-bytes'),
        size: 12,
      } as Express.Multer.File;
      prisma.unitMedia.create.mockImplementation(async ({ data: createData }) => ({
        id: 'media-4',
        ...createData,
      }));

      const result = await service.uploadMedia('unit-1', data, file);

      expect(storage.putObjectPublic).toHaveBeenCalledTimes(1);
      const [key, body, contentType] = storage.putObjectPublic.mock.calls[0] as [string, Buffer, string];
      expect(key).toMatch(/^unit-media\/[0-9a-f-]+\.png$/);
      expect(body).toBe(file.buffer);
      expect(contentType).toBe('image/png');
      expect(storage.getPublicUrl).toHaveBeenCalledWith(key);
      expect(prisma.unitMedia.create).toHaveBeenCalledWith({
        data: {
          unitId: 'unit-1',
          type: MediaType.RENDU_3D,
          url: `${PUBLIC_URL_PREFIX}${key}`,
          altText: 'Vue artiste',
          sortOrder: 0,
        },
      });
      expect(result).toMatchObject({
        unitId: 'unit-1',
        type: MediaType.RENDU_3D,
        altText: 'Vue artiste',
        sortOrder: 0,
      });
    });

    it('respecte un sortOrder explicite à l’upload', async () => {
      const data: UploadUnitMediaDto = { type: MediaType.PLAN, sortOrder: 3 };
      const file = {
        fieldname: 'file',
        originalname: 'plan.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: Buffer.from('pdf-bytes'),
        size: 9,
      } as Express.Multer.File;
      prisma.unitMedia.create.mockResolvedValue({ id: 'media-5' });

      await service.uploadMedia('unit-1', data, file);

      const [key] = storage.putObjectPublic.mock.calls[0] as [string];
      expect(key).toMatch(/^unit-media\/[0-9a-f-]+\.pdf$/);
      expect(prisma.unitMedia.create).toHaveBeenCalledWith({
        data: {
          unitId: 'unit-1',
          type: MediaType.PLAN,
          url: `${PUBLIC_URL_PREFIX}${key}`,
          altText: undefined,
          sortOrder: 3,
        },
      });
    });

    it('rejette un MIME hors whitelist avant tout appel à B2', async () => {
      const data: UploadUnitMediaDto = { type: MediaType.PHOTO };
      const file = {
        fieldname: 'file',
        originalname: 'virus.exe',
        encoding: '7bit',
        mimetype: 'application/x-msdownload',
        buffer: Buffer.from('x'),
        size: 1,
      } as Express.Multer.File;

      await expect(service.uploadMedia('unit-1', data, file)).rejects.toThrow(
        'Format non supporté : PNG, JPG, WebP ou PDF uniquement.',
      );
      expect(storage.putObjectPublic).not.toHaveBeenCalled();
      expect(prisma.unitMedia.create).not.toHaveBeenCalled();
    });

    it('nettoie le blob B2 si la création en base échoue (pas d’orphelin silencieux)', async () => {
      const data: UploadUnitMediaDto = { type: MediaType.PHOTO };
      const file = {
        fieldname: 'file',
        originalname: 'photo.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('jpg-bytes'),
        size: 9,
      } as Express.Multer.File;
      prisma.unitMedia.create.mockRejectedValue(new Error('base indisponible'));

      await expect(service.uploadMedia('unit-1', data, file)).rejects.toThrow(
        'base indisponible',
      );
      expect(storage.deleteObjectPublic).toHaveBeenCalledWith(expect.stringMatching(/^unit-media\//));
    });
  });

  describe('uploadProjectImage', () => {
    const mkFile = (mimetype: string, filename: string) =>
      ({
        fieldname: 'file',
        originalname: filename,
        encoding: '7bit',
        mimetype,
        buffer: Buffer.from('fake-bytes'),
        size: 10,
      }) as Express.Multer.File;

    it('uploade vers project-media/<uuid>.<ext> et retourne l\'URL publique', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1', name: 'Test' });

      const result = await service.uploadProjectImage('proj-1', mkFile('image/png', 'plan.png'));

      expect(prisma.project.findUnique).toHaveBeenCalledWith({ where: { id: 'proj-1' } });
      expect(storage.putObjectPublic).toHaveBeenCalledTimes(1);
      const [key, body, contentType] = storage.putObjectPublic.mock.calls[0] as [string, Buffer, string];
      expect(key).toMatch(/^project-media\/[0-9a-f-]+\.png$/);
      expect(body).toBeInstanceOf(Buffer);
      expect(contentType).toBe('image/png');
      expect(result).toEqual({ url: `${PUBLIC_URL_PREFIX}${key}` });
    });

    it('rejette un MIME hors whitelist', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1', name: 'Test' });

      await expect(
        service.uploadProjectImage('proj-1', mkFile('image/gif', 'plan.gif')),
      ).rejects.toThrow('Format non supporté');
      expect(storage.putObjectPublic).not.toHaveBeenCalled();
    });

    it('lève 404 si le projet n\'existe pas', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.uploadProjectImage('inexistant', mkFile('image/png', 'p.png')),
      ).rejects.toThrow('Projet introuvable');
      expect(storage.putObjectPublic).not.toHaveBeenCalled();
    });

    it('mapping MIME correct : JPEG -> .jpg, WebP -> .webp', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1', name: 'Test' });

      await service.uploadProjectImage('proj-1', mkFile('image/jpeg', 'photo.jpg'));
      const [key1] = storage.putObjectPublic.mock.calls[0] as [string];
      expect(key1).toMatch(/\.jpg$/);

      await service.uploadProjectImage('proj-1', mkFile('image/webp', 'render.webp'));
      const [key2] = storage.putObjectPublic.mock.calls[1] as [string];
      expect(key2).toMatch(/\.webp$/);
    });
  });
});
