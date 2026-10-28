import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user.interface';
import { MarketStudyGuard } from '../../common/market-study/market-study.guard';

@Controller('reservations')
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  // En étude de marché, le refus commercial (403) précède l'authentification :
  // inutile d'inviter un visiteur à se connecter pour une vente inexistante.
  @Post()
  @UseGuards(MarketStudyGuard, JwtAuthGuard)
  create(@Body('unitId') unitId: string, @CurrentUser() user: AuthUser) {
    return this.reservationService.reserveUnit(unitId, user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentUser() user: AuthUser) {
    return this.reservationService.findByUser(user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.reservationService.findOne(id, user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.reservationService.cancelReservation(id, user.id);
  }
}
