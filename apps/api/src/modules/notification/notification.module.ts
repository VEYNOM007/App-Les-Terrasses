import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationDispatchProcessor } from './notification-dispatch.processor';

@Global() // exporté globalement : quasi tous les modules injectent NotificationService
@Module({
  imports: [BullModule.registerQueue({ name: 'notification-dispatch' })],
  providers: [NotificationService, NotificationDispatchProcessor],
  controllers: [NotificationController],
  exports: [NotificationService],
})
export class NotificationModule {}
