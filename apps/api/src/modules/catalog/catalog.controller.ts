import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { SearchUnitsQueryDto } from './dto/search-units-query.dto';
import { PaymentPreviewQueryDto } from './dto/payment-preview-query.dto';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('projects')
  listProjects() {
    return this.catalogService.listProjects();
  }

  @Get('projects/:id')
  getProject(@Param('id') id: string) {
    return this.catalogService.getProject(id);
  }

  @Get('projects/:id/blocks')
  getProjectBlocks(@Param('id') id: string) {
    return this.catalogService.getProjectBlocks(id);
  }

  @Get('units')
  searchUnits(@Query() query: SearchUnitsQueryDto) {
    return this.catalogService.searchUnits(query);
  }

  @Get('typologies')
  getTypologies() {
    return this.catalogService.getTypologies();
  }

  @Get('units/:id')
  getUnit(@Param('id') id: string) {
    return this.catalogService.getUnit(id);
  }

  @Get('units/:id/payment-preview')
  getPaymentPreview(
    @Param('id') id: string,
    @Query() query: PaymentPreviewQueryDto,
  ) {
    return this.catalogService.getPaymentPreview(id, query.downPaymentPercent);
  }

  @Get('projects/:id/site-plan')
  getSitePlan(@Param('id') id: string) {
    return this.catalogService.getSitePlan(id);
  }
}
