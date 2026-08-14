import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ProjectService } from './project.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CreateBlockDto } from './dto/create-block.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { CreateUnitMediaDto, UpdateUnitMediaDto } from './dto/unit-media.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get('projects')
  listAllProjects() {
    return this.projectService.listAllProjects();
  }

  @Post('projects')
  createProject(@Body() body: CreateProjectDto) {
    return this.projectService.createProject(body);
  }

  @Patch('projects/:id')
  updateProject(@Param('id') id: string, @Body() body: UpdateProjectDto) {
    return this.projectService.updateProject(id, body);
  }

  @Post('blocks')
  createBlock(@Body() body: CreateBlockDto) {
    return this.projectService.createBlock(body);
  }

  @Post('units')
  createUnit(@Body() body: CreateUnitDto) {
    return this.projectService.createUnit(body);
  }

  @Patch('units/:id')
  updateUnit(@Param('id') id: string, @Body() body: UpdateUnitDto) {
    return this.projectService.updateUnit(id, body);
  }

  @Delete('units/:id')
  deleteUnit(@Param('id') id: string) {
    return this.projectService.deleteUnit(id);
  }

  @Post('units/:unitId/media')
  addMedia(@Param('unitId') unitId: string, @Body() body: CreateUnitMediaDto) {
    return this.projectService.addMedia(unitId, body);
  }

  @Patch('media/:mediaId')
  updateMedia(@Param('mediaId') mediaId: string, @Body() body: UpdateUnitMediaDto) {
    return this.projectService.updateMedia(mediaId, body);
  }

  @Delete('media/:mediaId')
  removeMedia(@Param('mediaId') mediaId: string) {
    return this.projectService.removeMedia(mediaId);
  }
}
