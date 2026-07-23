import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AuthService {
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

  async refresh(refreshToken: string) {
    // Vérification du refresh token (stratégie JWT dédiée ou table de
    // refresh tokens révocables selon le niveau de sécurité souhaité) —
    // simplifié ici, à durcir avant prod (rotation + révocation).
    const payload = this.jwt.verify(refreshToken, { secret: process.env.JWT_REFRESH_SECRET });
    return this.issueTokens(payload.sub, payload.role);
  }

  private issueTokens(userId: string, role: string) {
    const accessToken = this.jwt.sign({ sub: userId, role }, { expiresIn: '15m' });
    const refreshToken = this.jwt.sign(
      { sub: userId, role },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '30d' },
    );
    return { accessToken, refreshToken };
  }
}
