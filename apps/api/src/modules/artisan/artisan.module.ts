import { Module } from '@nestjs/common';
import { ArtisanService } from './artisan.service';
import { ArtisanController } from './artisan.controller';

@Module({
  providers: [ArtisanService],
  controllers: [ArtisanController],
  exports: [ArtisanService],
})
export class ArtisanModule {}
