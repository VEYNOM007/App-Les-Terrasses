import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { AuthUser } from './auth-user.interface';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SetupDto } from './dto/setup.dto';
import { KycUploadDto } from './dto/kyc-upload.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

/**
 * Options des cookies de session. Le `domain` n'est posé que si
 * COOKIE_DOMAIN est défini (production multi-sous-domaines : le cookie
 * posé par api-baguida.<domaine> doit être partagé avec baguida.<domaine>).
 * Les deux sous-domaines partagent le même registrable domain : c'est du
 * cross-origin mais same-site, donc SameSite=Lax suffit — pas de passage à
 * None (qui imposerait Secure absolu et affaiblirait la protection anti-CSRF).
 * Absent en dev local (localhost) pour rester fonctionnel.
 */
export function getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  };
}

const KYC_MAX_SIZE = 5 * 1024 * 1024; // 5 Mo
const KYC_ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'application/pdf']);

/**
 * Interceptor multipart : fichier chargé en mémoire (memoryStorage), jamais
 * écrit sur le disque du container. Le nom de fichier est généré côté
 * serveur par le service (clé interne B2 `kyc/<uuid>.<ext>`, extension
 * dérivée du MIME) — on n'utilise jamais le nom fourni par le client,
 * source classique de path traversal.
 */
const kycFileInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: KYC_MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!KYC_ALLOWED_MIMES.has(file.mimetype)) {
      cb(new BadRequestException('Format non supporté : PNG, JPG ou PDF uniquement.'), false);
      return;
    }
    cb(null, true);
  },
});

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    ...getCookieOptions(),
    maxAge: 15 * 60 * 1000, // 15 min (TTL de l'access token)
  });
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...getCookieOptions(),
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 jours
  });
}

function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_TOKEN_COOKIE, getCookieOptions());
  res.clearCookie(REFRESH_TOKEN_COOKIE, getCookieOptions());
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.register(body);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return { user: tokens.user };
  }

  @Post('setup')
  @HttpCode(HttpStatus.CREATED)
  async setup(@Body() body: SetupDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.setupAdmin(body);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return { user: tokens.user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.login(body.email, body.password);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return { user: tokens.user };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body.token, body.newPassword);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.refresh(res.req.cookies?.[REFRESH_TOKEN_COOKIE]);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return { user: tokens.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    await this.authService.logout(res.req.cookies?.[REFRESH_TOKEN_COOKIE]);
    clearAuthCookies(res);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  async logoutAll(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    await this.authService.logoutAll(user.id);
    clearAuthCookies(res);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Post('kyc')
  @UseInterceptors(kycFileInterceptor)
  async uploadKyc(
    @Body() body: KycUploadDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Fichier manquant.');
    return this.authService.uploadKyc(user.id, file);
  }
}
