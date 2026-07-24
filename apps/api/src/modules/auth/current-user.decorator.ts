import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from './auth-user.interface';

/**
 * Expose le user authentifié (posé sur request.user par JwtStrategy).
 *
 * Typé AuthUser : un `user: any` laisse passer `user.artisanId` même quand
 * la stratégie ne le peuple pas — le type force la cohérence avec
 * JwtStrategy.validate().
 */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthUser;
  },
);
