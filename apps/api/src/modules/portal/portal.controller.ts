import { Controller, Get, UseGuards } from '@nestjs/common';
import { PortalService } from './portal.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user.interface';

@UseGuards(JwtAuthGuard)
@Controller('portal')
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Get('dashboard')
  getDashboard(@CurrentUser() user: AuthUser) {
    return this.portalService.getDashboard(user.id);
  }

  @Get('documents')
  listDocuments(@CurrentUser() user: AuthUser) {
    return this.portalService.listDocuments(user.id);
  }
}
