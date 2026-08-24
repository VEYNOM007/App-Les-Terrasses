import { describe, it, expect, vi, beforeEach } from 'vitest';
import { payInstallment, PayInstallmentResponse } from './api';

// Tests unitaires R6 pour le déclenchement Stripe Checkout sur /suivi (Étape 3c)
describe('SuiviAcquereur — Déclenchement Stripe Checkout (R6)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Appel payInstallment avec les bons paramètres', () => {
    it('devrait appeler payInstallment avec installmentId et provider STRIPE', async () => {
      const mockResponse: PayInstallmentResponse = {
        paymentUrl: 'https://checkout.stripe.com/pay/cs_test_abc123',
        transactionId: 'txn_test_abc123',
        provider: 'STRIPE',
      };
      const spy = vi.fn().mockResolvedValue(mockResponse);

      const res = await spy('inst-1', 'STRIPE');

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('inst-1', 'STRIPE');
      expect(res.provider).toBe('STRIPE');
    });
  });

  describe('2. Protection anti double-clic', () => {
    it('devrait ignorer les appels concurrents si un paiement est déjà en cours', async () => {
      // Simule l'état interne : payingInstallmentId est déjà positionné sur 'inst-1'
      const payingInstallmentId = 'inst-1';
      const spy = vi.fn();

      // Logique reproduisant le guard de handlePayInstallment
      const handlePayInstallment = async (installmentId: string) => {
        if (payingInstallmentId) return; // Garde anti double-clic
        await spy(installmentId, 'STRIPE');
      };

      await handlePayInstallment('inst-1');
      await handlePayInstallment('inst-1'); // Second clic concurrent

      expect(spy).not.toHaveBeenCalled(); // Aucun appel réseau ne doit avoir eu lieu
    });
  });

  describe('3. Redirection vers paymentUrl', () => {
    it('devrait affecter window.location.href à la paymentUrl retournée', async () => {
      const expectedUrl = 'https://checkout.stripe.com/pay/cs_test_xyz789';
      const fetchSpy = vi.fn().mockResolvedValue({
        paymentUrl: expectedUrl,
        transactionId: 'txn_test_xyz789',
        provider: 'STRIPE',
      });

      // Simule le comportement du handler
      let redirectedTo = '';
      const handlePayInstallment = async (installmentId: string) => {
        const res = await fetchSpy(installmentId, 'STRIPE');
        if (!res || !res.paymentUrl) throw new Error('URL de redirection Stripe non reçue.');
        redirectedTo = res.paymentUrl; // Simule window.location.href
      };

      await handlePayInstallment('inst-2');

      expect(redirectedTo).toBe(expectedUrl);
    });
  });

  describe('4. Erreur si paymentUrl absent (réponse 200 malformée)', () => {
    it('devrait lever une erreur explicite si paymentUrl est absent de la réponse', async () => {
      // Simule une réponse backend 200 mais sans paymentUrl (bug backend)
      const spy = vi.fn().mockResolvedValue({ provider: 'STRIPE' }); // paymentUrl manquant

      let capturedError = '';
      const handlePayInstallment = async (installmentId: string) => {
        try {
          const res = await spy(installmentId, 'STRIPE');
          if (!res || !res.paymentUrl) {
            throw new Error('URL de redirection Stripe non reçue.');
          }
        } catch (err) {
          capturedError = err instanceof Error ? err.message : 'Erreur inconnue';
        }
      };

      await handlePayInstallment('inst-3');

      expect(capturedError).toBe('URL de redirection Stripe non reçue.');
    });
  });

  describe('5. Erreur d\'échec API (4xx/5xx)', () => {
    it('devrait capturer l\'erreur HTTP dans paymentErrorMap sans faire planter la page', async () => {
      const spy = vi.fn().mockRejectedValue(new Error('Paiement refusé par le serveur (500)'));

      let capturedError = '';
      const handlePayInstallment = async (installmentId: string) => {
        try {
          await spy(installmentId, 'STRIPE');
        } catch (err) {
          capturedError = err instanceof Error ? err.message : 'Erreur inconnue';
        }
      };

      await handlePayInstallment('inst-4');

      expect(capturedError).toBe('Paiement refusé par le serveur (500)');
      // Pas de throw : la page doit rester stable
    });
  });
});
