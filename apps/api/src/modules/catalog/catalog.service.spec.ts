import { ProjectStatus, UnitStatus, UnitType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DEFAULT_DOWN_PAYMENT_PERCENT } from '../../common/payment/installment-plan';

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
      include: {
        block: {
          include: {
            project: {
              select: { id: true, name: true, marketingInfo: true, siteMapImageUrl: true },
            },
          },
        },
        media: { orderBy: { sortOrder: 'asc' } },
      },
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

  describe('getTypologies', () => {
    it('agrège les unités par typologie avec compteurs, prix mini et rendu 3D', async () => {
      prisma.unit.findMany.mockResolvedValue([
        {
          id: 'unit-1',
          type: UnitType.T2,
          status: UnitStatus.DISPONIBLE,
          floor: 2,
          surface: 65,
          price: new Decimal(40_000_000),
          block: { name: 'Bloc A', frontage: 'Est' },
          media: [{ id: 'media-3d-1' }],
        },
        {
          id: 'unit-2',
          type: UnitType.T2,
          status: UnitStatus.VENDU,
          floor: 3,
          surface: 70,
          price: new Decimal(45_000_000),
          block: { name: 'Bloc B', frontage: 'Ouest' },
          media: [],
        },
        {
          id: 'unit-3',
          type: UnitType.T3,
          status: UnitStatus.DISPONIBLE,
          floor: 1,
          surface: 90,
          price: new Decimal(60_000_000),
          block: { name: 'Bloc A', frontage: 'Est' },
          media: [],
        },
      ]);

      const result = await service.getTypologies();

      expect(prisma.unit.findMany).toHaveBeenCalledWith({
        where: { block: { project: { status: ProjectStatus.PUBLIE } } },
        include: {
          block: { select: { name: true, frontage: true } },
          media: { where: { type: 'RENDU_3D' }, select: { id: true } },
        },
        orderBy: { price: 'asc' },
      });

      expect(result).toHaveLength(2);

      const t2 = result.find((t) => t.type === UnitType.T2);
      expect(t2).toBeDefined();
      expect(t2!).toMatchObject({
        totalUnits: 2,
        availableUnits: 1,
        minPrice: new Decimal(40_000_000),
      });
      expect(t2!.units[0]).toEqual({
        id: 'unit-1',
        blockName: 'Bloc A',
        blockFrontage: 'Est',
        floor: 2,
        surface: 65,
        price: new Decimal(40_000_000),
        status: UnitStatus.DISPONIBLE,
        hasRendu3D: true,
      });
      expect(t2!.units[1].hasRendu3D).toBe(false);

      const t3 = result.find((t) => t.type === UnitType.T3);
      expect(t3).toBeDefined();
      expect(t3!).toMatchObject({ totalUnits: 1, availableUnits: 1 });
      expect(t3!.minPrice.toNumber()).toBe(60_000_000);
    });
  });

  describe('getPaymentPreview', () => {
    const unitRow = {
      id: 'unit-1',
      price: new Decimal(50_000_000),
      currency: 'XOF',
      type: UnitType.T3,
    };

    it("ne retourne rien pour une unité dont le projet n'est pas publié (404)", async () => {
      prisma.unit.findFirst.mockResolvedValue(null);

      await expect(service.getPaymentPreview('unit-inconnue')).rejects.toThrow(
        'Unité introuvable.',
      );
    });

    it('propose l\'acompte par défaut (10 %) et 4 tranches qui somment au prix', async () => {
      prisma.unit.findFirst.mockResolvedValue(unitRow);

      const result = await service.getPaymentPreview('unit-1');

      expect(prisma.unit.findFirst).toHaveBeenCalledWith({
        where: { id: 'unit-1', block: { project: { status: ProjectStatus.PUBLIE } } },
        select: { id: true, price: true, currency: true, type: true },
      });
      expect(result.unitId).toBe('unit-1');
      expect(result.unitType).toBe(UnitType.T3);
      expect(result.downPaymentPercent).toBe(DEFAULT_DOWN_PAYMENT_PERCENT);
      expect(result.totalAmount.toNumber()).toBe(50_000_000);
      expect(result.currency).toBe('XOF');
      expect(result.installments).toHaveLength(5);
      expect(result.installments[0]).toMatchObject({
        label: 'Acompte réservation',
        percent: 0.1,
        amount: '5000000',
      });
      expect(result.installments[0].dueDate).toBeInstanceOf(Date);
      const total = result.installments.reduce((sum, i) => sum + Number(i.amount), 0);
      expect(total).toBe(50_000_000);
    });

    it('accepte un acompte personnalisé borné à 1 %', async () => {
      prisma.unit.findFirst.mockResolvedValue(unitRow);

      const result = await service.getPaymentPreview('unit-1', 1);

      expect(result.downPaymentPercent).toBe(1);
      expect(result.installments).toHaveLength(5);
      expect(result.installments[0].amount).toBe('500000');
      const total = result.installments.reduce((sum, i) => sum + Number(i.amount), 0);
      expect(total).toBe(50_000_000);
    });

    it('à 100 % d\'acompte, ne garde qu\'une seule échéance (aucune tranche à 0 FCFA)', async () => {
      prisma.unit.findFirst.mockResolvedValue(unitRow);

      const result = await service.getPaymentPreview('unit-1', 100);

      expect(result.downPaymentPercent).toBe(100);
      expect(result.installments).toHaveLength(1);
      expect(result.installments[0]).toMatchObject({
        label: 'Acompte réservation',
        amount: '50000000',
        percent: 1,
      });
      const total = result.installments.reduce((sum, i) => sum + Number(i.amount), 0);
      expect(total).toBe(50_000_000);
    });
  });
});
