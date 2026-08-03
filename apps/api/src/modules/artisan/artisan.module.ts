import { Module } from '@nestjs/common';
import { ArtisanService } from './artisan.service';
import { ArtisanController } from './artisan.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [ArtisanService],
  controllers: [ArtisanController],
  exports: [ArtisanService],
})
export class ArtisanModule {}
