import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisLockService } from './redis-lock.service';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379'),
    },
    RedisLockService,
  ],
  exports: ['REDIS_CLIENT', RedisLockService],
})
export class RedisModule {}
