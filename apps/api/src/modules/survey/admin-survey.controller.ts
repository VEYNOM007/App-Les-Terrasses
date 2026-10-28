import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ListSurveyQueryDto } from './dto/list-survey-query.dto';
import { toCsv } from './survey-csv';
import { SurveyService } from './survey.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/surveys')
export class AdminSurveyController {
  constructor(private readonly surveyService: SurveyService) {}

  @Get()
  list(@Query() query: ListSurveyQueryDto) {
    return this.surveyService.list(query.source);
  }

  @Get('export.csv')
  async exportCsv(
    @Query() query: ListSurveyQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rows = await this.surveyService.list(query.source);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="avis-terrasses-${date}.csv"`,
    );
    return toCsv(rows);
  }
}
