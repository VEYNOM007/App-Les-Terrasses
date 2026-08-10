import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';
import { MediaType } from '@prisma/client';

/**
 * Ajout d'un média à une unité (`POST /admin/units/:unitId/media`).
 * Un média de type RENDU_3D fait automatiquement apparaître le badge
 * "Vue d'artiste" sur la fiche unité (aucun toggle séparé).
 */
export class CreateUnitMediaDto {
  @IsEnum(MediaType)
  type!: MediaType;

  @IsUrl({ require_tld: false })
  url!: string;

  @IsOptional()
  @IsString()
  altText?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateUnitMediaDto extends PartialType(CreateUnitMediaDto) {}
