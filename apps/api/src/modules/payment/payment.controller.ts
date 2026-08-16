import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  UseGuards,
  Req,
  RawBodyRequest,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { PaymentService, CinetPayWebhookPayload } from './payment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user.interface';
import { PaymentProvider } from '@prisma/client';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Initie le paiement d'une échéance. Le front reçoit une paymentUrl à
   * rediriger (CinetPay) ou une session à ouvrir (Stripe Checkout).
   */
  @UseGuards(JwtAuthGuard)
  @Post('installments/:installmentId/pay')
  async payInstallment(
    @Param('installmentId') installmentId: string,
    @Body('provider') provider: PaymentProvider,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentService.initiatePayment(installmentId, provider, user.id);
  }

  /**
   * Échéancier de paiement d'une réservation (propriétaire uniquement).
   */
  @UseGuards(JwtAuthGuard)
  @Get('schedule/:reservationId')
  getSchedule(@Param('reservationId') reservationId: string, @CurrentUser() user: AuthUser) {
    return this.paymentService.getSchedule(reservationId, user.id);
  }

  /**
   * Historique des paiements de l'utilisateur connecté.
   */
  @UseGuards(JwtAuthGuard)
  @Get('history')
  getHistory(@CurrentUser() user: AuthUser) {
    return this.paymentService.getHistory(user.id);
  }

  /**
   * Webhook CinetPay — pas de guard JWT (appel serveur à serveur). CinetPay
   * ne signe pas ses notifications : la sécurité repose sur le rappel
   * serveur-à-serveur /v2/payment/check effectué dans le service (statut
   * réel + montant vérifiés avant toute écriture).
   */
  @SkipThrottle()
  @Post('webhooks/cinetpay')
  async cinetpayWebhook(@Body() payload: CinetPayWebhookPayload) {
    await this.paymentService.handleCinetPayWebhook(payload);
    return { received: true };
  }

  /**
   * Webhook Stripe — nécessite le rawBody (non parsé) pour vérifier la
   * signature HMAC via le SDK officiel. `rawBody: true` est configuré dans
   * main.ts : s'il manque, c'est une erreur de serveur (503) — on ne
   * re-sérialise JAMAIS le body parsé (la signature ne correspondrait pas).
   */
  @SkipThrottle()
  @Post('webhooks/stripe')
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    if (!req.rawBody) {
      throw new ServiceUnavailableException('rawBody non configuré pour le webhook Stripe.');
    }
    await this.paymentService.handleStripeWebhook(req.rawBody, signature);
    return { received: true };
  }
}
