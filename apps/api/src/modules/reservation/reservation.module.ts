import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReservationService } from './reservation.service';
import { ReservationController } from './reservation.controller';
import { ReservationExpirationProcessor } from './reservation-expiration.processor';
import { LaunchModule } from '../launch/launch.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'reservation-expiration' }),
    LaunchModule,
    forwardRef(() => PaymentModule),
  ],
  providers: [ReservationService, ReservationExpirationProcessor],
  controllers: [ReservationController],
  exports: [ReservationService],
})
export class ReservationModule {}
