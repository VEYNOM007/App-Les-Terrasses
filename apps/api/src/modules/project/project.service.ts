import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CreateBlockDto } from './dto/create-block.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { CreateUnitMediaDto, UpdateUnitMediaDto } from './dto/unit-media.dto';

/**
 * CRUD réservé admin pour projets/blocs/unités — distinct du CatalogModule
 * qui n'expose que la lecture publique des projets PUBLIE.
 */
@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  createProject(data: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        name: data.name,
        location: data.location,
        description: data.description,
        amenities: data.amenities,
        coverImage: data.coverImage,
        siteMapImageUrl: data.siteMapImageUrl,
        marketingInfo: data.marketingInfo as Prisma.InputJsonValue | undefined,
        views: data.views as Prisma.InputJsonValue | undefined,
        status: data.status,
      },
    });
  }

  updateProject(id: string, data: UpdateProjectDto) {
    return this.prisma.project.update({
      where: { id },
      data: {
        name: data.name,
        location: data.location,
        description: data.description,
        amenities: data.amenities,
        coverImage: data.coverImage,
        siteMapImageUrl: data.siteMapImageUrl,
        marketingInfo: data.marketingInfo as Prisma.InputJsonValue | undefined,
        views: data.views as Prisma.InputJsonValue | undefined,
        status: data.status,
      },
    });
  }

  createBlock(data: CreateBlockDto) {
    return this.prisma.block.create({
      data: {
        projectId: data.projectId,
        name: data.name,
        floors: data.floors,
        frontage: data.frontage,
        distanceFromEntranceM: data.distanceFromEntranceM,
        sitePlanPolygon: data.sitePlanPolygon?.map((p) => ({ x: p.x, y: p.y })),
      },
    });
  }

  createUnit(data: CreateUnitDto) {
    return this.prisma.unit.create({
      data: {
        blockId: data.blockId,
        type: data.type,
        surface: data.surface,
        floor: data.floor,
        price: data.price,
        currency: data.currency,
        planImage: data.planImage,
        photos: data.photos,
        status: data.status,
        hasStorefront: data.hasStorefront,
        streetFacing: data.streetFacing,
        marketingDescription: data.marketingDescription,
        highlights: data.highlights,
        virtualTourUrl: data.virtualTourUrl,
      },
    });
  }

  updateUnit(id: string, data: UpdateUnitDto) {
    return this.prisma.unit.update({
      where: { id },
      data: {
        type: data.type,
        surface: data.surface,
        floor: data.floor,
        price: data.price,
        currency: data.currency,
        planImage: data.planImage,
        photos: data.photos,
        status: data.status,
        hasStorefront: data.hasStorefront,
        streetFacing: data.streetFacing,
        marketingDescription: data.marketingDescription,
        highlights: data.highlights,
        virtualTourUrl: data.virtualTourUrl,
      },
    });
  }

  // ------------- Médias d'unité (admin) -------------

  addMedia(unitId: string, data: CreateUnitMediaDto) {
    return this.prisma.unitMedia.create({
      data: {
        unitId,
        type: data.type,
        url: data.url,
        altText: data.altText,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  updateMedia(id: string, data: UpdateUnitMediaDto) {
    return this.prisma.unitMedia.update({
      where: { id },
      data: {
        type: data.type,
        url: data.url,
        altText: data.altText,
        sortOrder: data.sortOrder,
      },
    });
  }

  async removeMedia(id: string) {
    try {
      return await this.prisma.unitMedia.delete({ where: { id } });
    } catch {
      throw new NotFoundException('Média introuvable.');
    }
  }

  listAllProjects() {
    // Inclut les BROUILLON, contrairement à CatalogService.listProjects()
    return this.prisma.project.findMany({ include: { blocks: true } });
  }
}
