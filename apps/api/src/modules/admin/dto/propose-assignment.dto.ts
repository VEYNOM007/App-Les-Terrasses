import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ProposeAssignmentDto {
  @IsString()
  artisanId!: string;

  @IsString()
  blockId!: string;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
