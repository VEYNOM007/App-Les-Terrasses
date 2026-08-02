import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
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
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject('REDIS_CLIENT') private readonly client: Redis) {}

  /**
   * Ferme proprement la connexion ioredis à l'arrêt de l'app — sans quoi
   * le handle reste ouvert et bloque la sortie du process (ex: workers
   * Jest qui ne terminent jamais après les e2e).
   */
  async onApplicationShutdown() {
    await this.client.quit();
  }
}
