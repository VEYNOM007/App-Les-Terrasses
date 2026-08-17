import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * DTO pour le premier setup admin (`POST /auth/setup`).
 * Identique au RegisterDto : même champs, pas de champ role.
 * Le role ADMIN est forcé côté service — un client ne peut pas se
 * promouvoir admin via ce champ.
 *
 * L'endpoint ne fonctionne qu'une seule fois : tant qu'au moins un
 * ADMIN existe en base, la requête est rejetée (403).
 */
export class SetupDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^\+?[0-9 ]{8,20}$/, {
    message: 'Numéro de téléphone invalide (attendu : +228 90 00 00 00).',
  })
  phone!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsOptional()
  @IsString()
  @Length(2, 3)
  country?: string;
}
