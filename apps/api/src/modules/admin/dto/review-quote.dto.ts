import { IsIn } from 'class-validator';

export class ReviewQuoteDto {
  @IsIn(['ACCEPTE', 'REFUSE'])
  decision!: 'ACCEPTE' | 'REFUSE';
}
