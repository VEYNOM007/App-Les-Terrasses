import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';

/**
 * CRUD réservé admin pour projets/blocs/unités — distinct du CatalogModule
 * qui n'expose que la lecture publique des projets PUBLIE.
 */
@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  createProject(data: Prisma.ProjectCreateInput) {
    return this.prisma.project.create({ data });
  }

  updateProject(id: string, data: Prisma.ProjectUpdateInput) {
    return this.prisma.project.update({ where: { id }, data });
  }

  createBlock(data: Prisma.BlockUncheckedCreateInput) {
    return this.prisma.block.create({ data });
  }

  createUnit(data: Prisma.UnitUncheckedCreateInput) {
    return this.prisma.unit.create({ data });
  }

  updateUnit(id: string, data: Prisma.UnitUpdateInput) {
    return this.prisma.unit.update({ where: { id }, data });
  }

  listAllProjects() {
    // Inclut les BROUILLON, contrairement à CatalogService.listProjects()
    return this.prisma.project.findMany({ include: { blocks: true } });
  }
}
