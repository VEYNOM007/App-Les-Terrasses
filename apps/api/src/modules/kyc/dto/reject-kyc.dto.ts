import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Motif de rejet d'une pièce d'identité — OBLIGATOIRE et non vide
 * (décision produit). Le motif est affiché à l'acheteur dans son suivi.
 */
export class RejectKycDto {
  @IsString()
  @IsNotEmpty({ message: 'Le motif de rejet est obligatoire.' })
  reason!: string;
}