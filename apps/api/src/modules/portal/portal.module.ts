import { Module } from '@nestjs/common';
import { PortalService } from './portal.service';
import { PortalController } from './portal.controller';

@Module({
  providers: [PortalService],
  controllers: [PortalController],
})
export class PortalModule {}
