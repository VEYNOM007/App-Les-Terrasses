import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: ('ACHETEUR' | 'COMMERCIAL' | 'ADMIN' | 'ARTISAN')[]) =>
  SetMetadata(ROLES_KEY, roles);
