import { Module, forwardRef } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { CinetPayClient } from './cinetpay.client';
import { StripeClient } from './stripe.client';
import { ReservationModule } from '../reservation/reservation.module';

@Module({
  imports: [forwardRef(() => ReservationModule)],
  providers: [PaymentService, CinetPayClient, StripeClient],
  controllers: [PaymentController],
  exports: [PaymentService, CinetPayClient, StripeClient],
})
export class PaymentModule {}
