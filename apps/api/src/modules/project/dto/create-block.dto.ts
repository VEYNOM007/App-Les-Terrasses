import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsNotEmptyObject, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Frontage } from '@prisma/client';

export class PolygonPointDto {
  @Type(() => Number)
  @IsInt()
  x!: number;

  @Type(() => Number)
  @IsInt()
  y!: number;
}

/**
 * Création d'un bloc par un admin (`POST /admin/blocks`).
 * `sitePlanPolygon` : coordonnées relatives (pourcentages 0-100) au plan
 * de masse du projet — validé comme tableau de points {x, y}.
 */
export class CreateBlockDto {
  @IsString()
  projectId!: string;

  @IsString()
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  floors!: number;

  @IsOptional()
  @IsEnum(Frontage)
  frontage?: Frontage;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  distanceFromEntranceM?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PolygonPointDto)
  sitePlanPolygon?: PolygonPointDto[];
}
