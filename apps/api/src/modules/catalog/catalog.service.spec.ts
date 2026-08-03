import { ProjectStatus, UnitStatus, UnitType } from '@prisma/client';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const createMockPrisma = () => ({
  project: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findFirstOrThrow: jest.fn(),
  },
  block: {
    findMany: jest.fn(),
  },
  unit: {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
});

describe('CatalogService', () => {
  let service: CatalogService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new CatalogService(prisma as unknown as PrismaService);
  });

  it('ne liste que les projets publiés avec leurs blocs et unités', async () => {
    prisma.project.findMany.mockResolvedValue([]);

    await service.listProjects();

    expect(prisma.project.findMany).toHaveBeenCalledWith({
      where: { status: ProjectStatus.PUBLIE },
      include: { blocks: { include: { units: true } } },
    });
  });

  it('ne retourne pas un projet brouillon par identifiant', async () => {
    prisma.project.findFirst.mockResolvedValue(null);

    const result = await service.getProject('project-draft');

    expect(result).toBeNull();
    expect(prisma.project.findFirst).toHaveBeenCalledWith({
      where: { id: 'project-draft', status: ProjectStatus.PUBLIE },
      include: { blocks: { include: { units: true } } },
    });
  });

  it('liste les blocs d’un projet publié dans l’ordre alphabétique', async () => {
    prisma.block.findMany.mockResolvedValue([]);

    await service.getProjectBlocks('project-1');

    expect(prisma.block.findMany).toHaveBeenCalledWith({
      where: { project: { id: 'project-1', status: ProjectStatus.PUBLIE } },
      orderBy: { name: 'asc' },
    });
  });

  it('applique la pagination et les filtres de recherche des unités', async () => {
    prisma.$transaction.mockResolvedValue([[{ id: 'unit-1' }], 1]);

    const result = await service.searchUnits({
      projectId: 'project-1',
      type: UnitType.T2,
      status: UnitStatus.DISPONIBLE,
      priceMin: 100,
      priceMax: 200,
      page: 2,
      limit: 10,
    });

    expect(result).toEqual({ data: [{ id: 'unit-1' }], total: 1, page: 2 });
    const expectedWhere = {
      block: { project: { status: ProjectStatus.PUBLIE, id: 'project-1' } },
      type: UnitType.T2,
      status: UnitStatus.DISPONIBLE,
      price: { gte: 100, lte: 200 },
    };
    expect(prisma.unit.findMany).toHaveBeenCalledWith({
      where: {
        ...expectedWhere,
      },
      skip: 10,
      take: 10,
    });
    expect(prisma.unit.count).toHaveBeenCalledWith({ where: expectedWhere });
  });

  it('ne retourne une unité publique que si son projet est publié', async () => {
    prisma.unit.findFirst.mockResolvedValue(null);

    const result = await service.getUnit('unit-draft');

    expect(result).toBeNull();
    expect(prisma.unit.findFirst).toHaveBeenCalledWith({
      where: { id: 'unit-draft', block: { project: { status: ProjectStatus.PUBLIE } } },
      include: { block: true },
    });
  });

  it('calcule un taux de remplissage nul pour un bloc sans unité', async () => {
    prisma.project.findFirstOrThrow.mockResolvedValue({
      id: 'project-1',
      name: 'Projet test',
      siteMapImageUrl: null,
      blocks: [
        {
          id: 'block-1',
          name: 'Bloc A',
          frontage: 'Est',
          distanceFromEntranceM: 10,
          sitePlanPolygon: null,
          launchStatus: 'EN_COMMERCIALISATION',
          constructionPhase: 'FONDATIONS',
          units: [],
        },
      ],
    });

    const result = await service.getSitePlan('project-1');

    expect(result.blocks[0].fillRatePercent).toBe(0);
    expect(result.blocks[0].totalUnits).toBe(0);
  });
});
