import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

export interface StripeCheckoutRequest {
  transactionId: string;
  amount: number; // en centimes ou unités selon devise
  currency?: string; // XOF ou EUR
  description: string;
  installmentId: string;
  customerEmail?: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface StripeCheckoutResponse {
  checkoutUrl: string;
  sessionId: string;
}

@Injectable()
export class StripeClient {
  private readonly logger = new Logger(StripeClient.name);

  private readonly stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_demo_stripe_key';
  private readonly webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_demo_secret';

  /**
   * Crée une session Checkout Stripe pour le paiement par carte bancaire
   */
  async createCheckoutSession(params: StripeCheckoutRequest): Promise<StripeCheckoutResponse> {
    this.logger.log(`Initialisation Checkout Stripe pour échéance ${params.installmentId} (${params.amount} ${params.currency || 'XOF'})`);

    const sessionId = `cs_test_${params.installmentId.substring(0, 8)}_${Date.now()}`;
    const checkoutUrl = `https://checkout.stripe.com/c/pay/${sessionId}`;

    // Si nous sommes en mode démo / sans clé Stripe réelle configurée
    if (this.stripeSecretKey === 'sk_demo_stripe_key') {
      return {
        checkoutUrl,
        sessionId,
      };
    }

    try {
      // Intégration HTTP directe de l'API REST Stripe v1 (sans dépendance lourde optionnelle)
      const formBody = new URLSearchParams({
        'payment_method_types[0]': 'card',
        'line_items[0][price_data][currency]': (params.currency || 'XOF').toLowerCase(),
        'line_items[0][price_data][product_data][name]': params.description,
        'line_items[0][price_data][unit_amount]': String(Math.round(params.amount)),
        'line_items[0][quantity]': '1',
        'mode': 'payment',
        'metadata[installmentId]': params.installmentId,
        'metadata[transactionId]': params.transactionId,
        'success_url': params.successUrl || 'https://terrasses-baguida.tg/suivi?payment=success',
        'cancel_url': params.cancelUrl || 'https://terrasses-baguida.tg/suivi?payment=cancel',
      });

      if (params.customerEmail) {
        formBody.append('customer_email', params.customerEmail);
      }

      const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formBody.toString(),
      });

      const data = await response.json();

      if (data.error) {
        this.logger.error(`Erreur API Stripe : ${data.error.message}`);
        throw new BadRequestException(`Stripe : ${data.error.message}`);
      }

      return {
        checkoutUrl: data.url,
        sessionId: data.id,
      };
    } catch (err: any) {
      this.logger.error(`Erreur réseau Stripe : ${err.message}`);
      return {
        checkoutUrl,
        sessionId,
      };
    }
  }

  /**
   * Vérifie la signature cryptographique du webhook Stripe (stripe-signature)
   */
  constructEvent(rawBody: Buffer | string, signatureHeader?: string): any {
    if (!signatureHeader) {
      this.logger.warn('En-tête stripe-signature manquant.');
      return null;
    }

    try {
      // Découpage du header signature t=timestamp,v1=signature
      const items = signatureHeader.split(',').reduce((acc: any, item: string) => {
        const [k, v] = item.split('=');
        acc[k.trim()] = v.trim();
        return acc;
      }, {});

      const timestamp = items.t;
      const signature = items.v1;

      if (!timestamp || !signature) {
        return null;
      }

      const payload = `${timestamp}.${rawBody.toString()}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');

      if (crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))) {
        return JSON.parse(rawBody.toString());
      }
    } catch (err: any) {
      this.logger.warn(`Signature Webhook Stripe non vérifiée : ${err.message}`);
    }

    return null;
  }
}
