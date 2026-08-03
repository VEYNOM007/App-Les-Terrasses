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
import { diskStorage } from 'multer';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { AuthUser } from './auth-user.interface';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { KycUploadDto } from './dto/kyc-upload.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

const KYC_UPLOAD_DIR = 'uploads/kyc';
const KYC_MAX_SIZE = 5 * 1024 * 1024; // 5 Mo
const KYC_ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'application/pdf']);
const KYC_EXT_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'application/pdf': '.pdf',
};

/**
 * Interceptor multipart : le nom de fichier est généré côté serveur
 * (UUID + extension dérivée du MIME) — on n'utilise jamais le nom
 * fourni par le client, source classique de path traversal.
 */
const kycFileInterceptor = FileInterceptor('file', {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(KYC_UPLOAD_DIR, { recursive: true });
      cb(null, KYC_UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = KYC_EXT_BY_MIME[file.mimetype] ?? '.bin';
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
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
    ...COOKIE_OPTIONS,
    maxAge: 15 * 60 * 1000, // 15 min (TTL de l'access token)
  });
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 jours
  });
}

function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_TOKEN_COOKIE, COOKIE_OPTIONS);
  res.clearCookie(REFRESH_TOKEN_COOKIE, COOKIE_OPTIONS);
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
