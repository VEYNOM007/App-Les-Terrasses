import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ArtisanService } from '../artisan/artisan.service';
import { CreateArtisanDto } from '../artisan/dto/create-artisan.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ProposeAssignmentDto } from './dto/propose-assignment.dto';
import { ReviewQuoteDto } from './dto/review-quote.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/artisans')
export class AdminArtisanController {
  constructor(private readonly artisanService: ArtisanService) {}

  @Get()
  list() {
    return this.artisanService.listArtisans();
  }

  @Post()
  create(@Body() body: CreateArtisanDto) {
    return this.artisanService.createArtisan(body);
  }

  @Post('assignments')
  proposeAssignment(@Body() body: ProposeAssignmentDto) {
    return this.artisanService.proposeAssignment(body);
  }

  @Patch('quotes/:quoteId/review')
  reviewQuote(@Param('quoteId') quoteId: string, @Body() body: ReviewQuoteDto) {
    return this.artisanService.reviewQuote(quoteId, body.decision);
  }
}
