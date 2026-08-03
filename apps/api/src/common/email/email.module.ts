import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';

/**
 * Module global d'envoi d'emails (SMTP). Volontairement sans queue
 * BullMQ : `EmailService` est injecté directement (ex: AuthService pour
 * les liens de reset) sans dépendre de Redis ni d'un worker de dispatch.
 */
@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
