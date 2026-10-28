import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListSurveyQueryDto {
  /** Filtre exact sur la source d'acquisition (?src=). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  source?: string;
}
