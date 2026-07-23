import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true }); // rawBody requis pour le webhook Stripe
  app.setGlobalPrefix('v1');
  app.enableCors();
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
