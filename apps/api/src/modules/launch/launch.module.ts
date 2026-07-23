import { Module } from '@nestjs/common';
import { LaunchService } from './launch.service';
import { LaunchController } from './launch.controller';

@Module({
  providers: [LaunchService],
  controllers: [LaunchController],
  exports: [LaunchService],
})
export class LaunchModule {}
