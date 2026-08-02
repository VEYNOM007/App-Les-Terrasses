import { IsEnum } from 'class-validator';

export enum KycDocumentType {
  CNI = 'cni',
  PASSEPORT = 'passeport',
  CARTE_SEJOUR = 'carte_sejour',
}

export class KycUploadDto {
  @IsEnum(KycDocumentType)
  documentType!: KycDocumentType;
}
