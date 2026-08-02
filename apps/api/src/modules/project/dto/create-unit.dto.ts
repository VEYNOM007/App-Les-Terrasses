import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { UnitStatus, UnitType } from '@prisma/client';

/**
 * Création d'une unité par un admin (`POST /admin/units`).
 * `price` est un montant en `currency` (défaut XOF) — 2 décimales max.
 */
export class CreateUnitDto {
  @IsString()
  blockId!: string;

  @IsEnum(UnitType)
  type!: UnitType;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  surface!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  floor!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  planImage?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  @IsEnum(UnitStatus)
  status?: UnitStatus;

  @IsOptional()
  @IsBoolean()
  hasStorefront?: boolean;

  @IsOptional()
  @IsBoolean()
  streetFacing?: boolean;
}
