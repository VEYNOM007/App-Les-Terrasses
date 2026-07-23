import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/dashboard')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('occupancy')
  getOccupancy() {
    return this.adminService.getOccupancy();
  }

  @Get('payments-overdue')
  getOverduePayments() {
    return this.adminService.getOverduePayments();
  }
}
