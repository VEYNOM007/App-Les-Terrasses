import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Résout le profil complet à chaque requête authentifiée : on ne se
 * contente pas du payload JWT brut (sub, role), on va chercher le
 * artisanId lié si le user est un artisan, pour que
 * req.user.artisanId soit toujours fiable dans les controllers —
 * plutôt que de dupliquer artisanId dans le JWT (qui deviendrait
 * périmé si le profil Artisan change sans réémission de token).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: { sub: string; role: string }) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: payload.sub },
      include: { artisanProfile: true },
    });

    return {
      id: user.id,
      role: user.role,
      email: user.email,
      artisanId: user.artisanProfile?.id ?? null,
    };
  }
}
