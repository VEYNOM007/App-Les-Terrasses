import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  BLOCKER_VALUES,
  BUDGET_CURRENCY_VALUES,
  BUDGET_VALUES,
  DECISION_MAKER_VALUES,
  PREFERENCE_VALUES,
  PROJECT_GOAL_VALUES,
  REASSURANCE_VALUES,
  RESIDENCE_VALUES,
  SIZE_VALUES,
  TOGO_LINK_VALUES,
} from '../survey.constants';

export class SurveyContactDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[\d\s().-]{7,20}$/, {
    message: 'Numéro WhatsApp invalide.',
  })
  whatsapp?: string | null;

  @IsBoolean()
  consent!: boolean;
}

export class CreateSurveyDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  source?: string;

  @IsString()
  @IsIn([...RESIDENCE_VALUES])
  residence!: string;

  @IsString()
  @IsIn([...TOGO_LINK_VALUES])
  togoLink!: string;

  @IsString()
  @IsIn([...PROJECT_GOAL_VALUES])
  projectGoal!: string;

  @IsString()
  @IsIn([...PREFERENCE_VALUES])
  preference!: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  whyText?: string | null;

  @IsString()
  @IsIn([...BUDGET_VALUES])
  budget!: string;

  @IsString()
  @IsIn([...BUDGET_CURRENCY_VALUES])
  budgetCurrency!: 'XOF' | 'EUR';

  @IsString()
  @IsIn([...SIZE_VALUES])
  size!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @IsIn([...DECISION_MAKER_VALUES], { each: true })
  decisionMakers!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @IsIn([...BLOCKER_VALUES], { each: true })
  blockers!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @IsIn([...REASSURANCE_VALUES], { each: true })
  reassurances!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  experienceText?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => SurveyContactDto)
  contact?: SurveyContactDto | null;
}
