import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReservationService } from './reservation.service';
import { ReservationController } from './reservation.controller';
import { ReservationExpirationProcessor } from './reservation-expiration.processor';
import { LaunchModule } from '../launch/launch.module';

@Module({
  imports: [BullModule.registerQueue({ name: 'reservation-expiration' }), LaunchModule],
  providers: [ReservationService, ReservationExpirationProcessor],
  controllers: [ReservationController],
  exports: [ReservationService],
})
export class ReservationModule {}
