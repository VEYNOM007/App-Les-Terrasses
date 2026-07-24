import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  UseGuards,
  Req,
  RawBodyRequest,
} from '@nestjs/common';
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
   * Webhook CinetPay — pas de guard JWT (appel serveur à serveur), la
   * sécurité repose sur la vérification de signature dans le service.
   */
  @Post('webhooks/cinetpay')
  async cinetpayWebhook(
    @Body() payload: CinetPayWebhookPayload,
    @Headers('x-cinetpay-signature') signature: string,
  ) {
    await this.paymentService.handleCinetPayWebhook(payload, signature);
    return { received: true };
  }

  /**
   * Webhook Stripe — nécessite le rawBody (non parsé) pour vérifier la
   * signature HMAC ; s'assurer que le middleware Express est configuré
   * avec `express.raw()` sur cette route spécifique, avant tout body-parser JSON global.
   */
  @Post('webhooks/stripe')
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
    await this.paymentService.handleStripeWebhook(rawBody, signature);
    return { received: true };
  }
}
