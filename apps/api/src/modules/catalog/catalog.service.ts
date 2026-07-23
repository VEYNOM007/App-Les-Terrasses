import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProjectStatus, UnitStatus, UnitType } from '@prisma/client';

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
      status: filters.status,
      price: { gte: filters.priceMin, lte: filters.priceMax },
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.unit.findMany({ where, skip: (page - 1) * limit, take: limit }),
      this.prisma.unit.count({ where }),
    ]);

    return { data, total, page };
  }

  async getUnit(id: string) {
    return this.prisma.unit.findUnique({ where: { id }, include: { block: true } });
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
        const totalUnits = b.units.length;
        const soldUnits = b.units.filter(
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
