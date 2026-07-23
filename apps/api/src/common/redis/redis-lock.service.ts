import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

/**
 * Lock distribué simple basé sur SET NX EX.
 * Utilisé pour protéger la fenêtre critique entre "l'utilisateur clique
 * Réserver" et "la transaction Prisma est validée", le temps que deux
 * requêtes concurrentes sur la même unité ne puissent pas passer en même
 * temps.
 *
 * Ce lock est volontairement court (quelques secondes) : il ne remplace
 * pas la logique métier de verrouillage 48h (Reservation.lockExpiresAt en
 * base), il protège seulement la course critique côté requête HTTP.
 */
@Injectable()
export class RedisLockService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  /**
   * Tente d'acquérir le lock. Retourne un token si succès, null sinon.
   * Le token doit être conservé pour libérer le lock en toute sécurité
   * (évite qu'un process libère un lock détenu par un autre après
   * expiration + ré-acquisition).
   */
  async acquire(key: string, ttlMs = 10_000): Promise<string | null> {
    const token = randomUUID();
    const result = await this.redis.set(key, token, 'PX', ttlMs, 'NX');
    return result === 'OK' ? token : null;
  }

  /**
   * Libère le lock uniquement si le token correspond (évite de libérer
   * le lock de quelqu'un d'autre si notre TTL a expiré entre-temps).
   */
  async release(key: string, token: string): Promise<void> {
    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `;
    await this.redis.eval(script, 1, key, token);
  }

  lockKeyForUnit(unitId: string): string {
    return `lock:unit:${unitId}`;
  }
}
