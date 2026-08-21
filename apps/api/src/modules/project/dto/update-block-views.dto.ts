import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';

export class BlockViewHotspotDto {
  @IsString()
  id!: string;

  @IsString()
  label!: string;

  @IsIn(['BLOCK', 'UNIT'])
  targetType!: 'BLOCK' | 'UNIT';

  @IsString()
  targetId!: string;

  @IsString()
  top!: string;

  @IsString()
  left!: string;
}

export class BlockViewDto {
  @IsString()
  id!: string;

  @IsString()
  title!: string;

  @IsString()
  subtitle!: string;

  @IsString()
  category!: string;

  @IsUrl()
  imageUrl!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlockViewHotspotDto)
  hotspots?: BlockViewHotspotDto[];
}

export class UpdateBlockViewsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlockViewDto)
  views!: BlockViewDto[];
}
