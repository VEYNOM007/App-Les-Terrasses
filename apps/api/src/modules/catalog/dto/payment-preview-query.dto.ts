import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaymentPreviewQueryDto {
  /** Acompte personnalisé (1-100 %). Absent → 10 % (défaut du projet). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  downPaymentPercent?: number;
}
