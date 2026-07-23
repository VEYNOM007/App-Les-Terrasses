import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { LaunchService } from './launch.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/blocks/:blockId/launch')
export class LaunchController {
  constructor(private readonly launchService: LaunchService) {}

  @Get('status')
  getStatus(@Param('blockId') blockId: string) {
    return this.launchService.getLaunchStatus(blockId);
  }

  @Get('funding-dossier')
  getDossier(@Param('blockId') blockId: string) {
    return this.launchService.generateFundingDossier(blockId);
  }

  @Patch('threshold')
  setThreshold(@Param('blockId') blockId: string, @Body('percent') percent: number) {
    return this.launchService.setFundingThreshold(blockId, percent);
  }

  @Post('submit-financing')
  submitFinancing(@Param('blockId') blockId: string) {
    return this.launchService.markFinancingSubmitted(blockId);
  }

  @Post('confirm-financing')
  confirmFinancing(@Param('blockId') blockId: string) {
    return this.launchService.markFinancingSecured(blockId);
  }
}
