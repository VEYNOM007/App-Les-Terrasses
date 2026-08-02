import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
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
