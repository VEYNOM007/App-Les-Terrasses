import { Module } from '@nestjs/common';
import { AdminSurveyController } from './admin-survey.controller';
import { SurveyController } from './survey.controller';
import { SurveyService } from './survey.service';

@Module({
  controllers: [SurveyController, AdminSurveyController],
  providers: [SurveyService],
})
export class SurveyModule {}
