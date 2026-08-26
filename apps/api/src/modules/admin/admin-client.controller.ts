import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminClientService } from './admin-client.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/clients')
export class AdminClientController {
  constructor(private readonly adminClientService: AdminClientService) {}

  @Get()
  list() {
    return this.adminClientService.listUsers();
  }

  @Patch(':userId/address')
  updateAddress(
    @Param('userId') userId: string,
    @Body('address') address: string | null,
  ) {
    return this.adminClientService.updateAddress(userId, address);
  }

  @Post(':userId/relance')
  relance(@Param('userId') userId: string) {
    return this.adminClientService.triggerRelance(userId);
  }
}
