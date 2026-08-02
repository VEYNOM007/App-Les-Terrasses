import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { AuthUser } from './auth-user.interface';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

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
}
