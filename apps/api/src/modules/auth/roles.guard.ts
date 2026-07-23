import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

/**
 * S'utilise TOUJOURS après JwtAuthGuard (qui peuple request.user).
 * Combo standard sur un controller/route admin :
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles('ADMIN')
 *
 * Si aucune métadonnée @Roles() n'est présente sur la route, l'accès est
 * autorisé par défaut (le guard ne restreint que les routes explicitement
 * annotées) — ne pas oublier d'annoter toute nouvelle route admin/artisan.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Accès réservé aux rôles: ${requiredRoles.join(', ')}.`,
      );
    }

    return true;
  }
}
