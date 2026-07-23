import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Usage: @Roles('ADMIN') ou @Roles('ADMIN', 'COMMERCIAL')
 * À combiner avec RolesGuard, toujours APRÈS JwtAuthGuard dans la chaîne
 * de @UseGuards() puisque RolesGuard lit request.user posé par le premier.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
