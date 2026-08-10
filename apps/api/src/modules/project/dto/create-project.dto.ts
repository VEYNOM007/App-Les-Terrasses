import { IsArray, IsEnum, IsObject, IsOptional, IsString, IsUrl } from 'class-validator';
import { ProjectStatus } from '@prisma/client';

/**
 * Création d'un projet par un admin (`POST /admin/projects`).
 * Le statut par défaut reste BROUILLON côté Prisma si non fourni : un
 * projet n'est visible publiquement qu'après passage explicite à PUBLIE.
 */
export class CreateProjectDto {
  @IsString()
  name!: string;

  @IsString()
  location!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @IsOptional()
  @IsUrl({ require_tld: false })
  coverImage?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  siteMapImageUrl?: string;

  /** Contenu marketing du projet (accroches, arguments de vente, …). */
  @IsOptional()
  @IsObject()
  marketingInfo?: Record<string, unknown>;

  /** Vues du catalogue (galerie, plan de masse, vue aérienne, …). */
  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  views?: Record<string, unknown>[];

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;
}
