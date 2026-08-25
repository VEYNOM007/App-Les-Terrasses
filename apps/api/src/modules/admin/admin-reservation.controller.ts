import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ReservationService } from '../reservation/reservation.service';
import { PaymentService } from '../payment/payment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminCreateReservationDto } from './dto/create-admin-reservation.dto';
import { AdminListReservationsQueryDto, UpdateReservationStatusDto } from './dto/reservation-status.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/reservations')
export class AdminReservationController {
  constructor(
    private readonly reservationService: ReservationService,
    private readonly paymentService: PaymentService,
  ) {}

  @Get()
  list(@Query() query: AdminListReservationsQueryDto) {
    return this.reservationService.adminList(query.status);
  }

  @Get(':reservationId')
  getOne(@Param('reservationId') reservationId: string) {
    return this.reservationService.adminGetReservation(reservationId);
  }

  /**
   * Vente commerciale enregistrée par un admin, avec offre personnalisée
   * éventuelle (offerPrice/offerLabel). Réutilise le mécanisme anti-double-
   * vente de ReservationService ; l'échéancier est généré sur le montant
   * réellement engagé (offerPrice ?? unit.price).
   */
  @Post()
  async create(@Body() body: AdminCreateReservationDto) {
    const reservation = await this.reservationService.adminCreateReservation(body);
    const schedule = await this.paymentService.generateSchedule(reservation.id);
    return { reservation, schedule };
  }

  @Patch(':reservationId/status')
  updateStatus(
    @Param('reservationId') reservationId: string,
    @Body() body: UpdateReservationStatusDto,
  ) {
    return this.reservationService.adminSetStatus(reservationId, body.status);
  }
}
