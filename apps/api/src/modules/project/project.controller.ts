import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ProjectService } from './project.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CreateBlockDto } from './dto/create-block.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import {
  CreateUnitMediaDto,
  UpdateUnitMediaDto,
  UploadUnitMediaDto,
} from './dto/unit-media.dto';
import { UpdateBlockViewsDto } from './dto/update-block-views.dto';

const MEDIA_MAX_SIZE = 15 * 1024 * 1024; // 15 Mo
const MEDIA_ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']);

/**
 * Interceptor multipart : fichier chargé en mémoire (memoryStorage), jamais
 * écrit sur le disque du container. Le nom de fichier est généré côté serveur
 * par le service (clé interne B2 `unit-media/<uuid>.<ext>`).
 */
const unitMediaFileInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: MEDIA_MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!MEDIA_ALLOWED_MIMES.has(file.mimetype)) {
      cb(new BadRequestException('Format non supporté : PNG, JPG, WebP ou PDF uniquement.'), false);
      return;
    }
    cb(null, true);
  },
});

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

  @Post('projects/:projectId/image/upload')
  @UseInterceptors(unitMediaFileInterceptor)
  uploadProjectImage(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('Fichier manquant.');
    return this.projectService.uploadProjectImage(projectId, file);
  }

  @Post('blocks')
  createBlock(@Body() body: CreateBlockDto) {
    return this.projectService.createBlock(body);
  }

  @Get('blocks/:blockId/views')
  getBlockViews(@Param('blockId') blockId: string) {
    return this.projectService.getBlockViews(blockId);
  }

  @Patch('blocks/:blockId/views')
  updateBlockViews(
    @Param('blockId') blockId: string,
    @Body() body: UpdateBlockViewsDto,
  ) {
    return this.projectService.updateBlockViews(blockId, body);
  }

  @Post('blocks/:blockId/image/upload')
  @UseInterceptors(unitMediaFileInterceptor)
  uploadBlockImage(
    @Param('blockId') blockId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('Fichier manquant.');
    return this.projectService.uploadBlockImage(blockId, file);
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

  @Post('units/:unitId/media/upload')
  @UseInterceptors(unitMediaFileInterceptor)
  uploadMedia(
    @Param('unitId') unitId: string,
    @Body() body: UploadUnitMediaDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('Fichier manquant.');
    return this.projectService.uploadMedia(unitId, body, file);
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
