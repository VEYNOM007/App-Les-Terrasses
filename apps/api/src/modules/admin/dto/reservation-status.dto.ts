import { IsIn, IsOptional } from 'class-validator';

/**
 * Statuts de réservation tels que présentés côté API (minuscules, contrat
 * OpenAPI) — mappés vers l'enum Prisma `ReservationStatus` (majuscules).
 */
export type AdminReservationStatusInput = 'en_attente' | 'confirmee' | 'annulee' | 'livree';

export class AdminListReservationsQueryDto {
  @IsOptional()
  @IsIn(['en_attente', 'confirmee', 'annulee', 'livree'])
  status?: AdminReservationStatusInput;
}

export class UpdateReservationStatusDto {
  @IsIn(['en_attente', 'confirmee', 'annulee', 'livree'])
  status!: AdminReservationStatusInput;
}
