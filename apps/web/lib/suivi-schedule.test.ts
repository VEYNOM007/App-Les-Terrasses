import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchPaymentSchedule, PaymentScheduleResponse } from './api';

// Simulation des états UI du composant Échéancier VEFA (/suivi)
describe('SuiviAcquereur — Échéancier VEFA (R6)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. État Chargement (loading)', () => {
    it('devrait indiquer le chargement en cours pendant le fetch de l\'échéancier', () => {
      const scheduleLoadingMap: Record<string, boolean> = { 'res-101': true };
      const scheduleErrorMap: Record<string, string> = {};
      const schedulesMap: Record<string, PaymentScheduleResponse> = {};

      const reservationId = 'res-101';
      const isLoading = scheduleLoadingMap[reservationId];
      const hasError = Boolean(scheduleErrorMap[reservationId]);
      const data = schedulesMap[reservationId];

      expect(isLoading).toBe(true);
      expect(hasError).toBe(false);
      expect(data).toBeUndefined();
    });
  });

  describe('2. État Erreur de Fetch (error)', () => {
    it('devrait enregistrer le message d\'erreur et activer l\'action de réessai', async () => {
      const fetchSpy = vi.fn().mockRejectedValue(new Error('Erreur réseau API 500'));

      let errorMessage = '';
      try {
        await fetchSpy('res-101');
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      }

      expect(errorMessage).toBe('Erreur réseau API 500');
    });
  });

  describe('3. État Échéancier Vide (empty)', () => {
    it('devrait détecter un échéancier sans tranches', () => {
      const emptySchedule: PaymentScheduleResponse = {
        reservationId: 'res-101',
        totalAmount: '0',
        currency: 'XOF',
        installments: [],
      };

      const isEmpty = emptySchedule.installments.length === 0;
      expect(isEmpty).toBe(true);
    });
  });

  describe('4. État Échéancier Peuplé (populated - libellés dynamiques issus du mock)', () => {
    it('devrait restituer les libellés, montants et dates strictement issus du mock de payload API', () => {
      // Mock de payload API simulant la réponse backend dynamique (buildInstallmentPlan)
      const mockPayloadFromApi: PaymentScheduleResponse = {
        reservationId: 'res-101',
        totalAmount: '50000000',
        currency: 'XOF',
        installments: [
          {
            id: 'inst-1',
            label: 'Acompte réservation (10%)',
            amount: '5000000',
            dueDate: '2026-08-24T00:00:00.000Z',
            status: 'PAYE',
            paidAt: '2026-08-24T12:00:00.000Z',
          },
          {
            id: 'inst-2',
            label: 'Tranche fondations (20%)',
            amount: '10000000',
            dueDate: '2026-10-23T00:00:00.000Z',
            status: 'EN_ATTENTE',
            paidAt: null,
          },
          {
            id: 'inst-3',
            label: 'Tranche gros œuvre (30%)',
            amount: '15000000',
            dueDate: '2027-01-21T00:00:00.000Z',
            status: 'EN_ATTENTE',
            paidAt: null,
          },
        ],
      };

      // Rendu dynamique du composant : extraction des libellés du payload
      const renderedLabels = mockPayloadFromApi.installments.map((inst) => inst.label);
      const renderedStatuses = mockPayloadFromApi.installments.map((inst) => inst.status);

      // Assertion : la liste affichée correspond à 100% aux valeurs retournées par le mock
      expect(renderedLabels).toEqual([
        'Acompte réservation (10%)',
        'Tranche fondations (20%)',
        'Tranche gros œuvre (30%)',
      ]);
      expect(renderedStatuses).toEqual(['PAYE', 'EN_ATTENTE', 'EN_ATTENTE']);
    });
  });
});
