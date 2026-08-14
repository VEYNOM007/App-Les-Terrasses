import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MediaType, ProjectStatus, UnitStatus, UnitType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  buildInstallmentPlan,
  DEFAULT_DOWN_PAYMENT_PERCENT,
} from '../../common/payment/installment-plan';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // Lecture publique uniquement — jamais de projet BROUILLON exposé ici.
  async listProjects() {
    return this.prisma.project.findMany({
      where: { status: ProjectStatus.PUBLIE },
      include: { blocks: { include: { units: true } } },
    });
  }

  async getProject(id: string) {
    return this.prisma.project.findFirst({
      where: { id, status: ProjectStatus.PUBLIE },
      include: { blocks: { include: { units: true } } },
    });
  }

  /**
   * Liste des blocs d'un projet publié — sert à la navigation catalogue
   * sans charger les unités (contrairement à getProject qui les inclut).
   */
  async getProjectBlocks(projectId: string) {
    return this.prisma.block.findMany({
      where: { project: { id: projectId, status: ProjectStatus.PUBLIE } },
      orderBy: { name: 'asc' },
    });
  }

  async searchUnits(filters: {
    projectId?: string;
    type?: UnitType;
    status?: UnitStatus;
    priceMin?: number;
    priceMax?: number;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const where = {
      block: { project: { status: ProjectStatus.PUBLIE, id: filters.projectId } },
      type: filters.type,
      // Exclusion ARCHIVE par défaut : une unité retirée du catalogue ne doit
      // pas refaire surface dans les résultats publics de recherche. Un statut
      // explicite passé par le client prime (usage admin/API avancé).
      status: filters.status ?? { not: UnitStatus.ARCHIVE },
      price: { gte: filters.priceMin, lte: filters.priceMax },
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.unit.findMany({ where, skip: (page - 1) * limit, take: limit }),
      this.prisma.unit.count({ where }),
    ]);

    return { data, total, page };
  }

  /**
   * Fiche unité enrichie — alimente la fiche produit (sheet) du catalogue :
   * unité + bloc + projet (infos marketing) + médias ordonnés.
   */
  async getUnit(id: string) {
    return this.prisma.unit.findFirst({
      where: {
        id,
        status: { not: UnitStatus.ARCHIVE },
        block: { project: { status: ProjectStatus.PUBLIE } },
      },
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
  }

  /**
   * Agrégats par typologie (STUDIO, T2, T3, …) pour la navigation hybride
   * du catalogue : compteurs + prix de départ + liste des unités disponibles
   * (id réel, bloc, étage, surface, prix, présence d'un rendu 3D). Chaque
   * carte mène ensuite à la fiche unité individuelle via /units/:id.
   */
  async getTypologies() {
    const units = await this.prisma.unit.findMany({
      where: {
        status: { not: UnitStatus.ARCHIVE },
        block: { project: { status: ProjectStatus.PUBLIE } },
      },
      include: {
        block: { select: { name: true, frontage: true } },
        media: {
          where: { type: MediaType.RENDU_3D },
          select: { id: true },
        },
      },
      orderBy: { price: 'asc' },
    });

    const byType = new Map<UnitType, typeof units>();
    for (const unit of units) {
      const bucket = byType.get(unit.type) ?? [];
      bucket.push(unit);
      byType.set(unit.type, bucket);
    }

    return [...byType.entries()].map(([type, list]) => {
      const available = list.filter((u) => u.status === UnitStatus.DISPONIBLE);
      const minPrice = list.reduce<Decimal>(
        (min, u) => (u.price.lt(min) ? u.price : min),
        list[0].price,
      );
      return {
        type,
        totalUnits: list.length,
        availableUnits: available.length,
        minPrice,
        units: list.map((u) => ({
          id: u.id,
          blockName: u.block.name,
          blockFrontage: u.block.frontage,
          floor: u.floor,
          surface: u.surface,
          price: u.price,
          status: u.status,
          hasRendu3D: u.media.length > 0,
        })),
      };
    });
  }

  /**
   * Aperçu public de l'échéancier pour une unité — alimente le simulateur
   * de financement du catalogue. Basé sur le prix catalogue `unit.price`
   * (les offres sont confidentielles et propres à chaque réservation).
   * Même fonction pure que PaymentService.generateSchedule().
   */
  async getPaymentPreview(unitId: string, downPaymentPercent?: number) {
    const unit = await this.prisma.unit.findFirst({
      where: {
        id: unitId,
        status: { not: UnitStatus.ARCHIVE },
        block: { project: { status: ProjectStatus.PUBLIE } },
      },
      select: { id: true, price: true, currency: true, type: true },
    });
    if (!unit) {
      throw new NotFoundException('Unité introuvable.');
    }

    const percent = downPaymentPercent ?? DEFAULT_DOWN_PAYMENT_PERCENT;
    const plan = buildInstallmentPlan({ totalAmount: unit.price.toNumber(), downPaymentPercent: percent });

    return {
      unitId: unit.id,
      unitType: unit.type,
      totalAmount: unit.price,
      currency: unit.currency,
      downPaymentPercent: percent,
      installments: plan.map(({ label, amount, dueDate, percent: pct }) => ({
        label,
        amount: amount.toString(),
        dueDate,
        percent: pct,
      })),
    };
  }

  /**
   * Alimente le plan de masse interactif : image de fond du terrain +
   * position (polygone) de chaque bloc, avec un résumé suffisant pour
   * colorer/annoter chaque bloc côté front (statut de lancement, taux
   * de remplissage, façade) sans requête supplémentaire par bloc.
   */
  async getSitePlan(projectId: string) {
    const project = await this.prisma.project.findFirstOrThrow({
      where: { id: projectId, status: ProjectStatus.PUBLIE },
      include: { blocks: { include: { units: true } } },
    });

    return {
      projectId: project.id,
      projectName: project.name,
      siteMapImageUrl: project.siteMapImageUrl,
      blocks: project.blocks.map((b) => {
        const visibleUnits = b.units.filter((u) => u.status !== UnitStatus.ARCHIVE);
        const totalUnits = visibleUnits.length;
        const soldUnits = visibleUnits.filter(
          (u) => u.status === UnitStatus.VENDU || u.status === UnitStatus.LIVRE,
        ).length;
        return {
          blockId: b.id,
          blockName: b.name,
          frontage: b.frontage,
          distanceFromEntranceM: b.distanceFromEntranceM,
          sitePlanPolygon: b.sitePlanPolygon,
          launchStatus: b.launchStatus,
          constructionPhase: b.constructionPhase,
          totalUnits,
          soldUnits,
          fillRatePercent: totalUnits === 0 ? 0 : Math.round((soldUnits / totalUnits) * 100),
        };
      }),
    };
  }
}
