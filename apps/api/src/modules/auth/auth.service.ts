import { Injectable, ConflictException, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { StorageService } from '../../common/storage/storage.service';
import { DocumentType, KycStatus } from '@prisma/client';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 30;
const REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1h
const RESET_GENERIC_MESSAGE =
  'Si un compte est associé à cet email, un lien de réinitialisation a été envoyé.';

/** Extension de clé interne dérivée du MIME, jamais du nom client. */
const KYC_EXT_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'application/pdf': '.pdf',
};

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
    private readonly storage: StorageService,
  ) {}

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

    return this.issueTokens(user);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Identifiants invalides.');
    }
    return this.issueTokens(user);
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
  async refresh(refreshToken: string | undefined) {
    if (!refreshToken) throw new UnauthorizedException('Refresh token manquant.');

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

    // Recharge le user complet (le payload JWT ne contient que sub/role)
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });

    // Émission + persistance du nouveau refresh (chaîné à l'ancien)
    return this.issueTokens(user, stored.tokenHash);
  }

  /**
   * Déconnexion ciblée : révoque uniquement le refresh token présenté.
   * L'access token reste valide jusqu'à expiration (15min max).
   */
  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
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
   * Crée un token de réinitialisation à usage unique (1h) pour un user et
   * retourne le token en clair (seul le hash est persisté). Méthode
   * publique : utilisée par `forgotPassword` ET par `createArtisan` pour
   * le premier accès d'un compte créé sans mot de passe.
   */
  async issuePasswordResetToken(userId: string): Promise<string> {
    const rawToken = crypto.randomBytes(32).toString('base64url');
    await this.prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash: hashRefreshToken(rawToken),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });
    return rawToken;
  }

  /**
   * Demande de réinitialisation de mot de passe.
   *
   * Anti-énumération : la réponse est identique que l'email existe ou non,
   * et aucun travail coûteux n'est fait quand le compte n'existe pas.
   *
   * Remise du token :
   *   - Hors production (dev/test) : token retourné dans la réponse + loggé
   *     (mode démo, comme le fallback des clients de paiement).
   *   - En production : le token n'est ni retourné ni loggé — il part par
   *     email via EmailService. Si SMTP n'est pas configuré, une erreur est
   *     loggée côté serveur (jamais le lien) et la réponse reste générique
   *     pour ne pas révéler l'existence du compte.
   * Les comptes artisans, eux, reçoivent leur token directement de l'admin
   * (createArtisan).
   */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { message: RESET_GENERIC_MESSAGE, resetToken: null };
    }

    const rawToken = await this.issuePasswordResetToken(user.id);

    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(`Reset token pour ${email}: ${rawToken}`);
      return { message: RESET_GENERIC_MESSAGE, resetToken: rawToken };
    }

    let delivered = false;
    let mode = 'smtp';
    try {
      const result = await this.email.sendPasswordResetEmail(user.email, rawToken);
      delivered = result.delivered;
      mode = result.mode;
    } catch {
      // Ne jamais révéler l'échec SMTP via le statut HTTP ou le message.
    }

    if (!delivered) {
      this.logger.error(
        `Lien de reset pour ${email} non transmis (mode ${mode}) — token émis mais inutilisable.`,
      );
    }

    return { message: RESET_GENERIC_MESSAGE, resetToken: null };
  }

  /**
   * Définit un nouveau mot de passe via un token à usage unique.
   * Vérifie hash + expiration + non-consommation, puis en une transaction :
   * consomme le token, met à jour le hash et révoque TOUS les refresh tokens
   * actifs du user (tout reset = toutes les sessions meurent, y compris un
   * éventuel attaquant ayant obtenu le token).
   */
  async resetPassword(token: string, newPassword: string) {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashRefreshToken(token) },
    });

    if (!record || record.usedAt !== null || record.expiresAt < new Date()) {
      throw new BadRequestException('Token de réinitialisation invalide ou expiré.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });
      await tx.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    return { message: 'Mot de passe mis à jour.' };
  }

  /**
   * Enregistre une pièce d'identité téléversée et passe le user en
   * `kycStatus = EN_ATTENTE`. Le fichier (buffer en mémoire, validé en
   * amont par multer : fileFilter + limits) est déposé sur B2 sous une
   * clé interne `kyc/<uuid>.<ext>` ; la base ne référence que cette clé —
   * jamais une URL B2, jamais un chemin disque.
   */
  async uploadKyc(userId: string, file: { buffer: Buffer; mimetype: string; originalname: string }) {
    const ext = KYC_EXT_BY_MIME[file.mimetype] ?? '.bin';
    const key = `kyc/${crypto.randomUUID()}${ext}`;
    await this.storage.putObject(key, file.buffer, file.mimetype);

    await this.prisma.document.create({
      data: {
        type: DocumentType.PIECE_IDENTITE,
        name: file.originalname,
        fileUrl: key,
        kycOwnerId: userId,
      },
    });

    return this.prisma.user.update({
      where: { id: userId },
      data: { kycStatus: KycStatus.EN_ATTENTE },
      select: { id: true, kycStatus: true },
    });
  }

  /**
   * Émet une paire access + refresh ET persiste le refresh token haché.
   * `previousTokenHash` non-null indique une rotation (le précédent
   * token doit déjà être marqué révoqué par l'appelant).
   * Retourne aussi le user (profils inclus) pour que le controller
   * puisse répondre `{ user }` sans requête supplémentaire.
   */
  private async issueTokens(user: {
    id: string;
    role: string;
    email: string;
    fullName: string;
    phone: string;
    country: string;
  }, previousTokenHash: string | null = null) {
    const accessToken = this.jwt.sign({ sub: user.id, role: user.role }, { expiresIn: ACCESS_TOKEN_TTL });
    // `jti` (UUID) : rend chaque refresh token unique même émis dans la
    // même seconde (le payload { sub, role } seul produirait un JWT
    // identique -> même tokenHash -> violation d'unicité en DB lors de
    // la rotation). C'est aussi un identifiant de session exploitable
    // pour du logging forensique.
    const refreshToken = this.jwt.sign(
      { sub: user.id, role: user.role, jti: crypto.randomUUID() },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: `${REFRESH_TOKEN_TTL_DAYS}d` },
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        previousTokenHash,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        role: user.role,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        country: user.country,
      },
    };
  }
}
