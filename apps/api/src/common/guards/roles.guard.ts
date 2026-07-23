import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '@prisma/client';

/**
 * Doit toujours être appliqué APRÈS JwtAuthGuard :
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 * JwtAuthGuard peuple request.user ; ce guard lit ensuite user.role.
 * Si aucun décorateur @Roles() n'est présent sur la route, l'accès est
 * autorisé par défaut (le guard ne restreint que ce qui est explicitement
 * marqué) — ne pas oublier @Roles() sur chaque route sensible.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('Utilisateur non authentifié.');
    }
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Accès réservé aux rôles: ${requiredRoles.join(', ')}. Rôle actuel: ${user.role}.`,
      );
    }
    return true;
  }
}
