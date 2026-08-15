import { Module } from '@nestjs/common';
import { PortalService } from './portal.service';
import { PortalController } from './portal.controller';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [StorageModule], // dépendance déclarée : download via URL signée B2
  providers: [PortalService],
  controllers: [PortalController],
})
export class PortalModule {}
