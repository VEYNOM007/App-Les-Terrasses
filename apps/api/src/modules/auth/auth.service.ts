import { Injectable, ConflictException, UnauthorizedException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 30;
const REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

/**
 * Hash SHA-256 du refresh token. On ne stocke jamais le token en clair :
 * si la base fuit, les tokens ne sont pas directement utilisables.
 * SHA-256 est adapté car le token est déjà un long random — pas besoin
 * de bcrypt (slow hash) comme pour un mot de passe utilisateur.
 */
function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async register(data: { email: string; phone: string; password: string; fullName: string; country?: string }) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: data.email }, { phone: data.phone }] },
    });
    if (existing) throw new ConflictException('Email ou téléphone déjà utilisé.');

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        phone: data.phone,
        passwordHash,
        fullName: data.fullName,
        country: data.country ?? 'TG',
      },
    });

    return this.issueTokens(user.id, user.role);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Identifiants invalides.');
    }
    return this.issueTokens(user.id, user.role);
  }

  /**
   * Refresh avec rotation et détection de réutilisation.
   *
   * Flow :
   *   1. verify signature JWT + extraire sub/role
   *   2. lookup RefreshToken en DB via tokenHash
   *   3. si introuvable ou expiré -> Unauthorized
   *   4. si token déjà révoqué -> compromission suspectée,
   *      on révoque toute la chaîne et on refuse
   *   5. sinon : on révoque ce token + on crée un nouveau refresh
   *      chaîné via previousTokenHash + nouvelle paire de tokens
   */
  async refresh(refreshToken: string) {
    let payload: { sub: string; role: string };
    try {
      payload = this.jwt.verify(refreshToken, { secret: process.env.JWT_REFRESH_SECRET });
    } catch {
      throw new UnauthorizedException('Refresh token invalide.');
    }

    const tokenHash = hashRefreshToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expiré ou inconnu.');
    }

    if (stored.revokedAt !== null) {
      // Réutilisation d'un token déjà rotaté : la chaîne est compromise.
      // On révoque toute la chaîne liée au user par sécurité.
      this.logger.warn(
        `Réutilisation suspectée du refresh token ${stored.id} pour user ${stored.userId} — révocation de toute la chaîne.`,
      );
      await this.revokeAllUserTokens(stored.userId);
      throw new UnauthorizedException('Refresh token réutilisé — session révoquée par sécurité.');
    }

    // Rotation : on marque l'ancien comme révoqué, on crée le suivant
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    // Émission + persistance du nouveau refresh (chaîné à l'ancien)
    return this.issueTokens(payload.sub, payload.role, stored.tokenHash);
  }

  /**
   * Déconnexion ciblée : révoque uniquement le refresh token présenté.
   * L'access token reste valide jusqu'à expiration (15min max).
   */
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Déconnexion globale : révoque tous les refresh tokens actifs du user.
   */
  async logoutAll(userId: string): Promise<void> {
    await this.revokeAllUserTokens(userId);
  }

  private async revokeAllUserTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Émet une paire access + refresh ET persiste le refresh token haché.
   * `previousTokenHash` non-null indique une rotation (le précédent
   * token doit déjà être marqué révoqué par l'appelant).
   */
  private async issueTokens(
    userId: string,
    role: string,
    previousTokenHash: string | null = null,
  ) {
    const accessToken = this.jwt.sign({ sub: userId, role }, { expiresIn: ACCESS_TOKEN_TTL });
    const refreshToken = this.jwt.sign(
      { sub: userId, role },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: `${REFRESH_TOKEN_TTL_DAYS}d` },
    );

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        previousTokenHash,
      },
    });

    return { accessToken, refreshToken };
  }
}
