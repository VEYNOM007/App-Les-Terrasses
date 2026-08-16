import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';

export interface CinetPayPaymentRequest {
  transactionId: string;
  amount: number;
  currency?: string; // XOF par défaut
  description: string;
  installmentId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  returnUrl?: string;
  notifyUrl?: string;
}

export interface CinetPayPaymentResponse {
  paymentUrl: string;
  transactionId: string;
  token?: string;
}

export interface CinetPayPaymentStatus {
  code: string;
  message?: string;
  status: string;
  amount: string;
  currency: string;
}

interface CinetPayInitResponse {
  code?: string;
  message?: string;
  data?: {
    payment_url?: string;
    payment_token?: string;
  };
}

interface CinetPayCheckResponse {
  code?: string;
  message?: string;
  data?: {
    status?: string;
    amount?: string;
    currency?: string;
    payment_date?: string;
    operator_id?: string;
  };
  api_response_id?: string;
}

@Injectable()
export class CinetPayClient {
  private readonly logger = new Logger(CinetPayClient.name);

  private readonly apiKey = process.env.CINETPAY_API_KEY;
  private readonly siteId = process.env.CINETPAY_SITE_ID;
  private readonly paymentEndpoint = 'https://api-checkout.cinetpay.com/v2/payment';
  private readonly checkEndpoint = 'https://api-checkout.cinetpay.com/v2/payment/check';
  private readonly defaultNotifyUrl = 'https://api.immo-les-terrasse.com/v1/payments/webhooks/cinetpay';
  private readonly defaultReturnUrl = 'https://immo-les-terrasse.com/suivi';

  /**
   * CinetPay n'accepte que des transactions lancées avec de vraies
   * identifiants marchand. Sans clés, on refuse explicitement (jamais de
   * faux succès ou d'URL de démo : cela masquerait une erreur réelle).
   */
  private assertConfigured(): void {
    if (!this.apiKey || !this.siteId) {
      this.logger.error('CinetPay non configuré : CINETPAY_API_KEY / CINETPAY_SITE_ID absentes.');
      throw new ServiceUnavailableException('CinetPay non configuré sur le serveur.');
    }
  }

  private async postJson<T>(endpoint: string, payload: Record<string, unknown>): Promise<T> {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'erreur inconnue';
      this.logger.error(`Erreur réseau CinetPay (${endpoint}) : ${message}`);
      throw new ServiceUnavailableException('CinetPay injoignable : paiement impossible à initier.');
    }

    try {
      return (await response.json()) as T;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'réponse non JSON';
      this.logger.error(`Réponse CinetPay invalide (${response.status}) : ${message}`);
      throw new ServiceUnavailableException('Réponse invalide du service CinetPay.');
    }
  }

  /**
   * Crée un lien de paiement CinetPay (Mobile Money / Flooz / T-Money).
   * Les erreurs remontent : aucune URL factice n'est jamais retournée.
   */
  async createPaymentSession(params: CinetPayPaymentRequest): Promise<CinetPayPaymentResponse> {
    this.assertConfigured();

    const payload: Record<string, unknown> = {
      apikey: this.apiKey,
      site_id: this.siteId,
      transaction_id: params.transactionId,
      amount: params.amount,
      currency: params.currency || 'XOF',
      description: params.description,
      customer_name: params.customerName,
      metadata: JSON.stringify({ installmentId: params.installmentId }),
      return_url: params.returnUrl || this.defaultReturnUrl,
      notify_url: params.notifyUrl || this.defaultNotifyUrl,
      channels: 'ALL',
    };
    if (params.customerEmail) {
      payload.customer_email = params.customerEmail;
    }
    if (params.customerPhone) {
      payload.customer_phone_number = params.customerPhone;
    }

    this.logger.log(`Initialisation paiement CinetPay ${params.transactionId} (${params.amount} XOF)`);

    const data = await this.postJson<CinetPayInitResponse>(this.paymentEndpoint, payload);

    if (data.code !== '201' || !data.data?.payment_url) {
      this.logger.error(`Erreur CinetPay (${data.code}) : ${data.message}`);
      throw new BadRequestException(`CinetPay : ${data.message ?? 'initialisation refusée'}`);
    }

    return {
      paymentUrl: data.data.payment_url,
      transactionId: params.transactionId,
      token: data.data.payment_token,
    };
  }

  /**
   * Vérifie l'état réel d'une transaction chez CinetPay (serveur-à-serveur).
   * Seule source de vérité : le contenu d'un webhook CinetPay ne doit
   * jamais être cru tel quel. Retourne le statut normalisé, sans lever
   * pour un statut métier (REFUSED/PENDING) — seule une indisponibilité
   * réseau/HTTP déclenche ServiceUnavailableException.
   */
  async checkPaymentStatus(transactionId: string): Promise<CinetPayPaymentStatus> {
    this.assertConfigured();

    const data = await this.postJson<CinetPayCheckResponse>(this.checkEndpoint, {
      apikey: this.apiKey,
      site_id: this.siteId,
      transaction_id: transactionId,
    });

    return {
      code: data.code ?? '',
      message: data.message,
      status: data.data?.status ?? '',
      amount: data.data?.amount ?? '',
      currency: data.data?.currency ?? '',
    };
  }
}
