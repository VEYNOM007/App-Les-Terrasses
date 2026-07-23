import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ConstructionService } from './construction.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('construction')
export class ConstructionController {
  constructor(private readonly constructionService: ConstructionService) {}

  @Get('blocks/:blockId/updates')
  getBlockUpdates(@Param('blockId') blockId: string) {
    return this.constructionService.getBlockUpdates(blockId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('blocks/:blockId/updates')
  publishUpdate(@Param('blockId') blockId: string, @Body() body: any, @CurrentUser() user: any) {
    return this.constructionService.publishUpdate(blockId, user.id, body);
  }

  @Get('units/:unitId/progress')
  getUnitProgress(@Param('unitId') unitId: string) {
    return this.constructionService.getUnitProgress(unitId);
  }
}
