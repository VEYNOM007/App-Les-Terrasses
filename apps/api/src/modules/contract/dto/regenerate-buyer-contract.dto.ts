import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Corps de la régénération d'un contrat acheteur (admin).
 *
 * `force` est la confirmation explicite demandée par le Palier 2 : un admin
 * souhaite remplacer un contrat déjà signé par l'administration (mais pas
 * encore par le propriétaire). Un simple re-clic ne suffit jamais — sans
 * `force: true` (et un contrat signé admin), le service renvoie 409.
 */
export class RegenerateBuyerContractDto {
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
