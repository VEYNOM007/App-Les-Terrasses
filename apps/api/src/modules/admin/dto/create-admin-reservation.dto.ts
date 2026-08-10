import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

/**
 * Vente commerciale enregistrée par un admin (`POST /admin/reservations`).
 * `offerPrice` est le montant réellement engagé par l'acheteur (remise
 * personnalisée) — jamais supérieur au prix catalogue (contrôlé en service)
 * et sans modification du prix public `unit.price`.
 */
export class AdminCreateReservationDto {
  @IsString()
  unitId!: string;

  @IsString()
  userId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  offerPrice?: number;

  @IsOptional()
  @IsString()
  offerLabel?: string;
}
