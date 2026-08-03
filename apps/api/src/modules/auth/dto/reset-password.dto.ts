import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72) // limite bcrypt (72 octets) — cohérent avec register.dto
  newPassword!: string;
}
