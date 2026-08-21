import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MediaType, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CreateBlockDto } from './dto/create-block.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import {
  CreateUnitMediaDto,
  UpdateUnitMediaDto,
  UploadUnitMediaDto,
} from './dto/unit-media.dto';
import { UpdateBlockViewsDto } from './dto/update-block-views.dto';

/** Extension de clé interne dérivée du MIME, jamais du nom client. */
const MEDIA_EXT_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

/**
 * CRUD réservé admin pour projets/blocs/unités — distinct du CatalogModule
 * qui n'expose que la lecture publique des projets PUBLIE.
 */
@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

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

  /**
   * Suppression réelle d'une unité — filet de sécurité rare, réservé aux
   * unités n'ayant JAMAIS eu de réservation (même ANNULEE). Toute historique
   * (réservation, échéancier, échéances) est protégé par la FK RESTRICT en
   * base : on remonte ici un 409 explicite au lieu d'un 500 brut. Le champ
   * quotidien de retrait du catalogue passe par `status: ARCHIVE`, pas par ici.
   */
  async deleteUnit(id: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id } });
    if (!unit) {
      throw new NotFoundException('Unité introuvable.');
    }

    // Toutes réservations confondues, y compris ANNULEE : une annulation reste
    // un historique légitime (funnel, traçabilité) qu'on ne détruit pas.
    const reservationCount = await this.prisma.reservation.count({ where: { unitId: id } });
    if (reservationCount > 0) {
      throw new ConflictException(
        'Impossible de supprimer cette unité : elle possède un historique de réservation ' +
          '(même annulée). Archivez-la (`status: ARCHIVE`) pour la masquer du catalogue.',
      );
    }

    // UnitMedia suit en cascade (`unit_media_unitId_fkey ON DELETE CASCADE`) ;
    // aucune réservation restante grâce au garde-fou ci-dessus.
    return this.prisma.unit.delete({ where: { id } });
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

  /**
   * Upload d'un fichier média vers le bucket public B2. La clé interne
   * (`unit-media/<uuid>.<ext>`, extension dérivée du MIME) et l'URL publique
   * stable sont générées côté serveur — jamais le nom du fichier client.
   * Si la création en base échoue après l'upload, le blob est retiré de B2
   * (best-effort, tracé en log) pour ne pas laisser d'orphelin.
   */
  async uploadMedia(unitId: string, data: UploadUnitMediaDto, file: Express.Multer.File) {
    const ext = MEDIA_EXT_BY_MIME[file.mimetype];
    if (!ext) {
      throw new BadRequestException('Format non supporté : PNG, JPG, WebP ou PDF uniquement.');
    }
    const key = `unit-media/${crypto.randomUUID()}${ext}`;
    await this.storage.putObjectPublic(key, file.buffer, file.mimetype);

    try {
      return await this.prisma.unitMedia.create({
        data: {
          unitId,
          type: data.type,
          url: this.storage.getPublicUrl(key),
          altText: data.altText,
          sortOrder: data.sortOrder ?? 0,
        },
      });
    } catch (error) {
      await this.storage.deleteObjectPublic(key).catch((cleanupError) => {
        this.logger.warn(
          `Blob B2 public non nettoyé après échec de création en base (${key}) : ` +
            `${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
        );
      });
      throw error;
    }
  }

  /**
   * Upload d'une image de niveau projet (plan de masse, vue aérienne, etc.)
   * vers le bucket public B2. La clé interne (`project-media/<uuid>.<ext>`)
   * est distincte de `unit-media/` pour permettre un filtrage et un audit
   * séparés dans le bucket.
   *
   * Contrairement à `uploadMedia()`, aucune création en base ici : l'URL
   * retournée sera pushée via `PATCH /admin/projects/:id` avec le champ
   * `views` ou `siteMapImageUrl`.
   */
  async uploadProjectImage(projectId: string, file: Express.Multer.File) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException('Projet introuvable.');
    }

    const ext = MEDIA_EXT_BY_MIME[file.mimetype];
    if (!ext) {
      throw new BadRequestException('Format non supporté : PNG, JPG, WebP ou PDF uniquement.');
    }

    const key = `project-media/${crypto.randomUUID()}${ext}`;
    await this.storage.putObjectPublic(key, file.buffer, file.mimetype);

    return { url: this.storage.getPublicUrl(key) };
  }

  // ------------- Vues par bloc (admin) -------------

  async getBlockViews(blockId: string) {
    const block = await this.prisma.block.findUnique({ where: { id: blockId } });
    if (!block) {
      throw new NotFoundException('Bloc introuvable.');
    }
    return block.views;
  }

  async updateBlockViews(blockId: string, data: UpdateBlockViewsDto) {
    const block = await this.prisma.block.findUnique({ where: { id: blockId } });
    if (!block) {
      throw new NotFoundException('Bloc introuvable.');
    }
    return this.prisma.block.update({
      where: { id: blockId },
      data: { views: data.views as unknown as Prisma.InputJsonValue },
    });
  }

  async uploadBlockImage(blockId: string, file: Express.Multer.File) {
    const block = await this.prisma.block.findUnique({ where: { id: blockId } });
    if (!block) {
      throw new NotFoundException('Bloc introuvable.');
    }

    const ext = MEDIA_EXT_BY_MIME[file.mimetype];
    if (!ext) {
      throw new BadRequestException('Format non supporté : PNG, JPG, WebP ou PDF uniquement.');
    }

    const key = `project-media/${crypto.randomUUID()}${ext}`;
    await this.storage.putObjectPublic(key, file.buffer, file.mimetype);

    return { url: this.storage.getPublicUrl(key) };
  }

  /**
   * Suppression d'un média : le delete Prisma est la source de vérité, puis
   * le blob B2 est retiré du bucket public (best-effort). Si B2 échoue après
   * le delete en base, on logge une trace au lieu de bloquer — jamais de blob
   * orphelin silencieux. Les URL externes (collées par l'admin) ne déclenchent
   * rien (`extractKeyFromPublicUrl` renvoie null).
   */
  async removeMedia(id: string) {
    const media = await this.prisma.unitMedia.findUnique({ where: { id } });
    if (!media) throw new NotFoundException('Média introuvable.');

    await this.prisma.unitMedia.delete({ where: { id } });

    const key = this.storage.extractKeyFromPublicUrl(media.url);
    if (key) {
      try {
        await this.storage.deleteObjectPublic(key);
      } catch (error) {
        this.logger.warn(
          `Blob B2 public orphelin non supprimé (${key}) : ` +
            `${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return media;
  }

  listAllProjects() {
    // Inclut les BROUILLON, contrairement à CatalogService.listProjects().
    // Unités (médias ordonnés) incluses : le panneau admin s'alimente à cette
    // source unique, qui montre aussi les ARCHIVE (exclus du catalogue public).
    return this.prisma.project.findMany({
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
  }
}
