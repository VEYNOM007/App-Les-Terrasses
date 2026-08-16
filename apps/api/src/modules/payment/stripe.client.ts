import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import Stripe from 'stripe';

export interface StripeCheckoutRequest {
  transactionId: string;
  /** Montant à facturer en CENTIMES d'euro (déjà converti par PaymentService). */
  amountEurCents: number;
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

  private readonly secretKey = process.env.STRIPE_SECRET_KEY;
  private readonly webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  private readonly defaultSuccessUrl = 'https://immo-les-terrasse.com/suivi?payment=success';
  private readonly defaultCancelUrl = 'https://immo-les-terrasse.com/suivi?payment=cancel';

  /**
   * Stripe facture en EUR pour la diaspora : le montant reçu est déjà en
   * centimes d'euro (conversion XOF→EUR effectuée côté PaymentService).
   * Sans clé secrète, on refuse explicitement — jamais d'URL de démo ou
   * de faux succès : cela masquerait une erreur réelle.
   */
  private requireSecret(value: string | undefined, name: string): string {
    if (!value) {
      this.logger.error(`Stripe non configuré : ${name} absente.`);
      throw new ServiceUnavailableException(`Stripe non configuré : ${name} absente.`);
    }
    return value;
  }

  /**
   * Crée une Checkout Session hébergée (mode payment, EUR). Les erreurs
   * réseau remontent en 503 ; une erreur API (clé/paramètres invalides)
   * remonte en BadRequest — aucune URL de secours n'est jamais retournée.
   */
  async createCheckoutSession(params: StripeCheckoutRequest): Promise<StripeCheckoutResponse> {
    const key = this.requireSecret(this.secretKey, 'STRIPE_SECRET_KEY');

    this.logger.log(
      `Initialisation Checkout Stripe pour échéance ${params.installmentId} (${params.amountEurCents} EUR cents)`,
    );

    let session: Stripe.Checkout.Session;
    try {
      const stripe = new Stripe(key);
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'eur',
              unit_amount: params.amountEurCents,
              product_data: { name: params.description },
            },
          },
        ],
        metadata: {
          installmentId: params.installmentId,
          transactionId: params.transactionId,
        },
        success_url: params.successUrl || this.defaultSuccessUrl,
        cancel_url: params.cancelUrl || this.defaultCancelUrl,
        ...(params.customerEmail ? { customer_email: params.customerEmail } : {}),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'erreur inconnue';
      this.logger.error(`Erreur Stripe (création de session) : ${message}`);
      if (err instanceof Stripe.errors.StripeConnectionError) {
        throw new ServiceUnavailableException('Stripe injoignable : paiement impossible à initier.');
      }
      throw new BadRequestException(`Stripe : ${message}`);
    }

    if (!session.url || !session.id) {
      this.logger.error('Session Stripe créée sans url/id — réponse inattendue.');
      throw new ServiceUnavailableException('Réponse inattendue du service Stripe.');
    }

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
    };
  }

  /**
   * Vérifie STRICTEMENT la signature du webhook via le SDK officiel
   * (stripe.webhooks.constructEvent). Aucun repli sur le body brut ni sur
   * un secret factice : signature invalide ou absente → BadRequestException
   * (rejeté, jamais traité). Secret non configuré → 503 (Stripe retentera).
   */
  constructEvent(rawBody: Buffer | string, signatureHeader: string | undefined): Stripe.Event {
    const secret = this.requireSecret(this.webhookSecret, 'STRIPE_WEBHOOK_SECRET');

    if (!signatureHeader) {
      throw new BadRequestException('En-tête stripe-signature manquant.');
    }

    try {
      return Stripe.webhooks.constructEvent(rawBody, signatureHeader, secret);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'erreur inconnue';
      this.logger.warn(`Signature Webhook Stripe non vérifiée : ${message}`);
      throw new BadRequestException('Signature Stripe invalide.');
    }
  }
}
