import { IsEnum } from 'class-validator';

export enum KycDocumentType {
  CNI = 'cni',
  PASSEPORT = 'passeport',
  CARTE_SEJOUR = 'carte_sejour',
}

/**
 * Faces requises par type de pièce. La CNI et la carte de séjour portent des
 * informations essentielles (date d'expiration, adresse, numéro) réparties
 * recto ET verso : les 2 faces sont donc exigées. Un passeport n'a qu'une
 * page photographique : seul le recto est requis.
 */
export const KYC_SIDE_REQUIREMENTS: Record<KycDocumentType, { recto: boolean; verso: boolean }> = {
  [KycDocumentType.CNI]: { recto: true, verso: true },
  [KycDocumentType.CARTE_SEJOUR]: { recto: true, verso: true },
  [KycDocumentType.PASSEPORT]: { recto: true, verso: false },
};

/** Le verso d'une pièce est-il requis pour ce type ? */
export function kycRequiresVerso(type: KycDocumentType): boolean {
  return KYC_SIDE_REQUIREMENTS[type].verso;
}

export class KycUploadDto {
  @IsEnum(KycDocumentType)
  documentType!: KycDocumentType;
}
