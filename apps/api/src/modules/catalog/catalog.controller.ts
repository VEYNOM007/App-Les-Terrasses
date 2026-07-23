import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';

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

  @Get('units')
  searchUnits(@Query() query: any) {
    return this.catalogService.searchUnits(query);
  }

  @Get('units/:id')
  getUnit(@Param('id') id: string) {
    return this.catalogService.getUnit(id);
  }

  @Get('projects/:id/site-plan')
  getSitePlan(@Param('id') id: string) {
    return this.catalogService.getSitePlan(id);
  }
}
