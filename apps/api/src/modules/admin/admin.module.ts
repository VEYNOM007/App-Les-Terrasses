import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminArtisanController } from './admin-artisan.controller';
import { AdminReservationController } from './admin-reservation.controller';
import { AdminClientController } from './admin-client.controller';
import { AdminClientService } from './admin-client.service';
import { ArtisanModule } from '../artisan/artisan.module';
import { ReservationModule } from '../reservation/reservation.module';

@Module({
  imports: [ArtisanModule, ReservationModule],
  providers: [AdminService, AdminClientService],
  controllers: [
    AdminController,
    AdminArtisanController,
    AdminReservationController,
    AdminClientController,
  ],
})
export class AdminModule {}
