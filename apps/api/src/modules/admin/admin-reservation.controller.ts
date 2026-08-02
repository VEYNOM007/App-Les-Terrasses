import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ReservationService } from '../reservation/reservation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminListReservationsQueryDto, UpdateReservationStatusDto } from './dto/reservation-status.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/reservations')
export class AdminReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  @Get()
  list(@Query() query: AdminListReservationsQueryDto) {
    return this.reservationService.adminList(query.status);
  }

  @Patch(':reservationId/status')
  updateStatus(
    @Param('reservationId') reservationId: string,
    @Body() body: UpdateReservationStatusDto,
  ) {
    return this.reservationService.adminSetStatus(reservationId, body.status);
  }
}
