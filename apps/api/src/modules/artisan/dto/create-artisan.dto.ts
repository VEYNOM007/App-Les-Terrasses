import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Métiers acceptés côté API, en minuscules (contrat OpenAPI ArtisanInput) —
 * mappés vers l'enum Prisma `ArtisanTrade` (majuscules) dans le service.
 */
export enum ArtisanTradeInput {
  MACONNERIE = 'maconnerie',
  ELECTRICITE = 'electricite',
  PLOMBERIE = 'plomberie',
  MENUISERIE = 'menuiserie',
  PEINTURE = 'peinture',
  CARRELAGE = 'carrelage',
  TOITURE = 'toiture',
  AUTRE = 'autre',
}

export class CreateArtisanDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  phone!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsString()
  @MinLength(2)
  companyName!: string;

  @IsEnum(ArtisanTradeInput)
  trade!: ArtisanTradeInput;

  @IsOptional()
  @IsString()
  tradeLicenseUrl?: string;
}
