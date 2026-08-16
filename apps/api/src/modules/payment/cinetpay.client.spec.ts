import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { CinetPayClient } from './cinetpay.client';

const API_KEY = 'test_api_key';
const SITE_ID = 'test_site_id';

/**
 * Tests unitaires — CinetPayClient (aucun appel HTTP réel)
 *
 * Règle R6 (argent) :
 *  - jamais d'URL factice/fallback : clés absentes → 503, erreur réseau → 503
 *  - checkPaymentStatus normalise ACCEPTED/REFUSED sans lever (décision au service)
 *  - notify_url / return_url par défaut = routes réelles de production
 */
describe('CinetPayClient', () => {
  const originalApiKey = process.env.CINETPAY_API_KEY;
  const originalSiteId = process.env.CINETPAY_SITE_ID;

  let fetchSpy: jest.SpyInstance;
  let client: CinetPayClient;

  const paymentParams = {
    transactionId: 'TX-123',
    amount: 500000,
    description: 'Paiement Acompte réservation',
    installmentId: 'inst-001',
    customerName: 'Kofi Mensah',
  };

  beforeEach(() => {
    process.env.CINETPAY_API_KEY = API_KEY;
    process.env.CINETPAY_SITE_ID = SITE_ID;
    client = new CinetPayClient();
  });

  afterEach(() => {
    if (fetchSpy) {
      fetchSpy.mockRestore();
    }
  });

  afterAll(() => {
    if (originalApiKey === undefined) {
      delete process.env.CINETPAY_API_KEY;
    } else {
      process.env.CINETPAY_API_KEY = originalApiKey;
    }
    if (originalSiteId === undefined) {
      delete process.env.CINETPAY_SITE_ID;
    } else {
      process.env.CINETPAY_SITE_ID = originalSiteId;
    }
  });

  describe('sans clés configurées', () => {
    beforeEach(() => {
      delete process.env.CINETPAY_API_KEY;
      delete process.env.CINETPAY_SITE_ID;
      client = new CinetPayClient();
    });

    it('createPaymentSession lève 503 (jamais d\'URL factice)', async () => {
      await expect(client.createPaymentSession(paymentParams)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('checkPaymentStatus lève 503', async () => {
      await expect(client.checkPaymentStatus('TX-123')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('createPaymentSession', () => {
    it('retourne paymentUrl quand CinetPay répond code 201, avec notify_url/return_url réels', async () => {
      fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            code: '201',
            message: 'CREATED',
            data: { payment_url: 'https://checkout.cinetpay.com/pay/tx', payment_token: 'tok' },
          }),
          { status: 201 },
        ),
      );

      const result = await client.createPaymentSession(paymentParams);

      expect(result.paymentUrl).toBe('https://checkout.cinetpay.com/pay/tx');
      expect(result.transactionId).toBe('TX-123');
      expect(result.token).toBe('tok');

      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://api-checkout.cinetpay.com/v2/payment');
      const sent = JSON.parse((init as RequestInit).body as string) as Record<string, unknown>;
      expect(sent.transaction_id).toBe('TX-123');
      expect(sent.apikey).toBe(API_KEY);
      expect(sent.site_id).toBe(SITE_ID);
      expect(sent.notify_url).toBe(
        'https://api.immo-les-terrasse.com/v1/payments/webhooks/cinetpay',
      );
      expect(sent.return_url).toBe('https://immo-les-terrasse.com/suivi');
    });

    it('lève BadRequestException si CinetPay refuse l\'initialisation (code != 201)', async () => {
      fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ code: '609', message: 'AUTH_NOT_FOUND' }), { status: 200 }),
      );

      await expect(client.createPaymentSession(paymentParams)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('propage une erreur réseau en 503 — aucune URL de secours', async () => {
      fetchSpy = jest
        .spyOn(globalThis, 'fetch')
        .mockRejectedValue(new TypeError('fetch failed'));

      await expect(client.createPaymentSession(paymentParams)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('checkPaymentStatus', () => {
    it('normalise une réponse ACCEPTED', async () => {
      fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            code: '00',
            message: 'SUCCES',
            data: { status: 'ACCEPTED', amount: '500000', currency: 'XOF' },
          }),
          { status: 200 },
        ),
      );

      const status = await client.checkPaymentStatus('TX-123');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api-checkout.cinetpay.com/v2/payment/check',
        expect.anything(),
      );
      expect(status.code).toBe('00');
      expect(status.status).toBe('ACCEPTED');
      expect(status.amount).toBe('500000');
      expect(status.currency).toBe('XOF');
    });

    it('normalise une réponse REFUSED sans lever (décision métier au service)', async () => {
      fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            code: '627',
            message: 'TRANSACTION_CANCEL',
            data: { status: 'REFUSED', amount: '500000', currency: 'XOF' },
          }),
          { status: 200 },
        ),
      );

      const status = await client.checkPaymentStatus('TX-123');

      expect(status.code).toBe('627');
      expect(status.status).toBe('REFUSED');
    });

    it('lève ServiceUnavailableException si CinetPay est injoignable', async () => {
      fetchSpy = jest
        .spyOn(globalThis, 'fetch')
        .mockRejectedValue(new TypeError('fetch failed'));

      await expect(client.checkPaymentStatus('TX-123')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
