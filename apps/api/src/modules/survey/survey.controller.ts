import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CreateSurveyDto } from './dto/create-survey.dto';
import { SurveyService } from './survey.service';

@Controller('survey')
export class SurveyController {
  constructor(private readonly surveyService: SurveyService) {}

  /**
   * Public et anonyme. Limite dédiée (5/min/IP) plus stricte que le
   * throttler global : un questionnaire ne s'envoie qu'une fois.
   */
  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  create(@Body() dto: CreateSurveyDto) {
    return this.surveyService.create(dto);
  }
}
