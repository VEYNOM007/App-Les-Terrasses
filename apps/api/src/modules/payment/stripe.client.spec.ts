import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import Stripe from 'stripe';
import { StripeClient, StripeCheckoutRequest } from './stripe.client';

const SECRET_KEY = 'sk_test_123';
const WEBHOOK_SECRET = 'whsec_test_123';

/**
 * Le SDK stripe est mocké uniquement sur `checkout.sessions.create`
 * (l'appel réseau sortant). La vérification de signature, elle, reste
 * RÉELLE : `webhooks` (statique) est conservé tel quel — les tests
 * utilisent `Stripe.webhooks.generateTestHeaderString` pour produire une
 * vraie signature HMAC et vérifier que `constructEvent` rejette toute
 * signature forgée/modifiée (règle R6, chemin argent).
 */
jest.mock('stripe', () => {
  const realStripe = jest.requireActual('stripe');
  const StripeClass = realStripe.default ?? realStripe;
  const sessionsCreate = jest.fn();

  const MockStripe = jest.fn().mockImplementation(function (this: unknown, key: string) {
    const instance = new StripeClass(key);
    instance.checkout.sessions.create = sessionsCreate;
    return instance;
  });

  // Statiques réels conservés : la vérification de signature du webhook
  // passe par `Stripe.webhooks.constructEvent`, jamais par un mock.
  Object.assign(MockStripe, {
    webhooks: StripeClass.webhooks,
    errors: StripeClass.errors,
  });

  return {
    __esModule: true,
    default: MockStripe,
    __sessionsCreate: sessionsCreate,
    __errors: StripeClass.errors,
  };
});

const { __sessionsCreate: sessionsCreate, __errors: StripeErrors } = jest.requireMock(
  'stripe',
) as {
  __sessionsCreate: jest.Mock;
  __errors: typeof Stripe.errors;
};

/**
 * Tests unitaires — StripeClient (aucun appel réseau réel)
 *
 * Règle R6 (argent) :
 *  - jamais d'URL factice/fallback : clés absentes → 503, erreur réseau → 503
 *  - facturation en CENTIMES d'EUR (Stripe ne supporte pas XOF)
 *  - constructEvent vérifie STRICTEMENT la signature HMAC : header absent,
 *    signature forgée ou secret différent → rejet BadRequest, jamais traité
 */
describe('StripeClient', () => {
  const originalSecretKey = process.env.STRIPE_SECRET_KEY;
  const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let client: StripeClient;

  const checkoutParams: StripeCheckoutRequest = {
    transactionId: 'TX-123',
    amountEurCents: 76225,
    description: 'Paiement Acompte réservation - Résidence Baguida',
    installmentId: 'inst-001',
  };

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = SECRET_KEY;
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    client = new StripeClient();
    sessionsCreate.mockReset();
  });

  afterAll(() => {
    if (originalSecretKey === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = originalSecretKey;
    }
    if (originalWebhookSecret === undefined) {
      delete process.env.STRIPE_WEBHOOK_SECRET;
    } else {
      process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
    }
  });

  describe('sans clés configurées', () => {
    beforeEach(() => {
      delete process.env.STRIPE_SECRET_KEY;
      delete process.env.STRIPE_WEBHOOK_SECRET;
      client = new StripeClient();
    });

    it("createCheckoutSession lève 503 sans STRIPE_SECRET_KEY (jamais d'URL factice)", async () => {
      await expect(client.createCheckoutSession(checkoutParams)).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(sessionsCreate).not.toHaveBeenCalled();
    });

    it('constructEvent lève 503 sans STRIPE_WEBHOOK_SECRET (jamais de secret factice)', () => {
      expect(() => client.constructEvent('payload', 't=1,v1=abc')).toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('createCheckoutSession', () => {
    it('facture en EUR (centimes) avec metadata + URLs réelles, et retourne url/id', async () => {
      sessionsCreate.mockResolvedValue({
        id: 'cs_test_1',
        url: 'https://checkout.stripe.com/c/pay/cs_test_1',
      });

      const result = await client.createCheckoutSession(checkoutParams);

      expect(result.sessionId).toBe('cs_test_1');
      expect(result.checkoutUrl).toBe('https://checkout.stripe.com/c/pay/cs_test_1');

      expect(sessionsCreate).toHaveBeenCalledTimes(1);
      const sent = sessionsCreate.mock.calls[0][0];
      expect(sent.mode).toBe('payment');
      expect(sent.line_items).toEqual([
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: 76225,
            product_data: { name: checkoutParams.description },
          },
        },
      ]);
      expect(sent.metadata).toEqual({ installmentId: 'inst-001', transactionId: 'TX-123' });
      expect(sent.success_url).toBe('https://immo-les-terrasse.com/suivi?payment=success');
      expect(sent.cancel_url).toBe('https://immo-les-terrasse.com/suivi?payment=cancel');
    });

    it('passe customer_email et les URLs personnalisées quand fournis', async () => {
      sessionsCreate.mockResolvedValue({
        id: 'cs_test_2',
        url: 'https://checkout.stripe.com/c/pay/cs_test_2',
      });

      await client.createCheckoutSession({
        ...checkoutParams,
        customerEmail: 'kofi@test.tg',
        successUrl: 'https://app.immo-les-terrasse.com/merci',
        cancelUrl: 'https://app.immo-les-terrasse.com/annule',
      });

      const sent = sessionsCreate.mock.calls[0][0];
      expect(sent.customer_email).toBe('kofi@test.tg');
      expect(sent.success_url).toBe('https://app.immo-les-terrasse.com/merci');
      expect(sent.cancel_url).toBe('https://app.immo-les-terrasse.com/annule');
    });

    it('lève 503 sur une erreur de connexion — aucune URL de secours', async () => {
      sessionsCreate.mockRejectedValue(
        new StripeErrors.StripeConnectionError({ message: 'connection failed' }),
      );

      await expect(client.createCheckoutSession(checkoutParams)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it("lève BadRequestException sur une erreur API (clé/paramètres invalides)", async () => {
      sessionsCreate.mockRejectedValue(
        new StripeErrors.StripeInvalidRequestError({ message: 'invalid key' }),
      );

      await expect(client.createCheckoutSession(checkoutParams)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lève 503 si la session est créée sans url/id (réponse inattendue)', async () => {
      sessionsCreate.mockResolvedValue({ id: 'cs_test_3' } as never);

      await expect(client.createCheckoutSession(checkoutParams)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('constructEvent', () => {
    const payload = JSON.stringify({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', amount_total: 76225 } },
    });

    it('retourne l\'événement si la signature HMAC est valide', () => {
      const signature = Stripe.webhooks.generateTestHeaderString({
        payload,
        secret: WEBHOOK_SECRET,
      });

      const event = client.constructEvent(payload, signature);

      expect(event.id).toBe('evt_1');
      expect(event.type).toBe('checkout.session.completed');
    });

    it('rejette une signature forgée sur un payload modifié', () => {
      const signature = Stripe.webhooks.generateTestHeaderString({
        payload,
        secret: WEBHOOK_SECRET,
      });
      const tamperedPayload = payload.replace('cs_1', 'cs_FORGED');

      expect(() => client.constructEvent(tamperedPayload, signature)).toThrow(
        BadRequestException,
      );
    });

    it("rejette si le secret du webhook ne correspond pas (mauvais whsec)", () => {
      const signature = Stripe.webhooks.generateTestHeaderString({
        payload,
        secret: 'whsec_autrebout_de_chaîne',
      });

      expect(() => client.constructEvent(payload, signature)).toThrow(BadRequestException);
    });

    it("rejette si l'en-tête stripe-signature est absent", () => {
      expect(() => client.constructEvent(payload, undefined)).toThrow(BadRequestException);
    });
  });
});
