import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('reservations')
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  @Post()
  create(@Body('unitId') unitId: string, @CurrentUser() user: any) {
    return this.reservationService.reserveUnit(unitId, user.id);
  }

  @Get()
  findMine(@CurrentUser() user: any) {
    return this.reservationService.findByUser(user.id);
  }

  @Delete(':id')
  cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.reservationService.cancelReservation(id, user.id);
  }
}
