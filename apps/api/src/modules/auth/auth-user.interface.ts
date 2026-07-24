import { UserRole } from '@prisma/client';

/**
 * Forme garantie de request.user après JwtAuthGuard.
 *
 * Issue de JwtStrategy.validate() : ne jamais peupler ce type à la main
 * ailleurs que dans cette stratégie (sinon artisanId peut diverger du
 * profil Artisan réel en DB — voir CLAUDE.md § sécurité des rôles).
 */
export interface AuthUser {
  id: string;
  role: UserRole;
  email: string;
  artisanId: string | null;
}
