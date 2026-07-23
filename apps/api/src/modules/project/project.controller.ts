import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ProjectService } from './project.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post('projects')
  createProject(@Body() body: any) {
    return this.projectService.createProject(body);
  }

  @Patch('projects/:id')
  updateProject(@Param('id') id: string, @Body() body: any) {
    return this.projectService.updateProject(id, body);
  }

  @Post('blocks')
  createBlock(@Body() body: any) {
    return this.projectService.createBlock(body);
  }

  @Post('units')
  createUnit(@Body() body: any) {
    return this.projectService.createUnit(body);
  }

  @Patch('units/:id')
  updateUnit(@Param('id') id: string, @Body() body: any) {
    return this.projectService.updateUnit(id, body);
  }
}
