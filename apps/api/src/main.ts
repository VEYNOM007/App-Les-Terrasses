import { Logger, ValidationPipe } from '@nestjs/common';
import { ValidationExceptionFilter } from './common/filters/validation-exception.filter';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

const DEFAULT_CORS_ORIGINS = 'http://localhost:3000';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true, // rawBody requis pour le webhook Stripe
  });

  // L'API est exposée derrière l'Nginx hôte (reverse proxy) : on fait
  // confiance au premier saut pour que req.ip reflète le client réel
  // (rate-limit par-IP du Throttler — sinon tous les clients apparaissent
  // comme 127.0.0.1) et que req.protocol/req.secure soient corrects.
  // Nginx append $remote_addr en fin de X-Forwarded-For : l'IP lue est la
  // vraie IP client, non falsifiable.
  app.set('trust proxy', 1);

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

  // Filet de sécurité : transforme les erreurs de validation (class-validator,
  // message en tableau) en messages français lisibles. Les erreurs métier
  // (message en string, déjà rédigées pour l'utilisateur) restent intactes.
  app.useGlobalFilters(new ValidationExceptionFilter());

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  Logger.log(`API démarrée sur :${port}`, 'Bootstrap');
}
bootstrap();
