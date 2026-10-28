import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user.interface';
import { MarketStudyGuard } from '../../common/market-study/market-study.guard';

@UseGuards(JwtAuthGuard)
@Controller('reservations')
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  @Post()
  @UseGuards(MarketStudyGuard)
  create(@Body('unitId') unitId: string, @CurrentUser() user: AuthUser) {
    return this.reservationService.reserveUnit(unitId, user.id);
  }

  @Get()
  findMine(@CurrentUser() user: AuthUser) {
    return this.reservationService.findByUser(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.reservationService.findOne(id, user.id);
  }

  @Delete(':id')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.reservationService.cancelReservation(id, user.id);
  }
}
