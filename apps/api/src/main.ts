import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

const DEFAULT_CORS_ORIGINS = 'http://localhost:3000';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true }); // rawBody requis pour le webhook Stripe
  app.setGlobalPrefix('v1');

  // Cookies JWT httpOnly : parser des cookies entrants (access/refresh tokens)
  app.use(cookieParser());

  // Sécurité de base : en-têtes HTTP (X-Frame-Options, CSP, HSTS, …)
  app.use(helmet());

  // CORS restreint aux origines explicites (jamais `*`). En Phase 1 les
  // cookies httpOnly exigent `credentials: true`.
  const allowedOrigins = (process.env.CORS_ORIGINS ?? DEFAULT_CORS_ORIGINS)
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  app.enableCors({ origin: allowedOrigins, credentials: true });

  // Validation globale : whitelist (ignore les champs inconnus), rejet des
  // champs non déclarés (forbidNonWhitelisted) et conversion de types (DTO).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  Logger.log(`API démarrée sur :${port}`, 'Bootstrap');
}
bootstrap();
