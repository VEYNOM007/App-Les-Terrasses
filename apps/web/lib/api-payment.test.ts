import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  payInstallment,
  fetchPaymentSchedule,
  fetchPaymentHistory,
  PayInstallmentResponse,
  PaymentScheduleResponse,
  PaymentHistoryItem,
} from './api';

describe('Payment API Client Helpers (Stripe)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('payInstallment', () => {
    it('devrait appeler POST /v1/payments/installments/:id/pay avec provider STRIPE et credentials include', async () => {
      const mockResponse: PayInstallmentResponse = {
        paymentUrl: 'https://checkout.stripe.com/pay/cs_test_123',
        transactionId: 'TX-inst123-1700000000',
        provider: 'STRIPE',
        sessionId: 'cs_test_123',
      };

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = fetchSpy;

      const result = await payInstallment('inst-123', 'STRIPE');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];

      expect(url).toContain('/v1/payments/installments/inst-123/pay');
      expect(options.method).toBe('POST');
      expect(options.credentials).toBe('include');
      expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(JSON.parse(options.body)).toEqual({ provider: 'STRIPE' });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('fetchPaymentSchedule', () => {
    it('devrait appeler GET /v1/payments/schedule/:reservationId avec credentials include', async () => {
      const mockResponse: PaymentScheduleResponse = {
        reservationId: 'res-456',
        totalAmount: '45000000',
        currency: 'XOF',
        installments: [
          {
            id: 'inst-1',
            label: 'Acompte réservation (5%)',
            amount: '2250000',
            dueDate: '2026-09-01T00:00:00.000Z',
            status: 'EN_ATTENTE',
            paidAt: null,
          },
        ],
      };

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = fetchSpy;

      const result = await fetchPaymentSchedule('res-456');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];

      expect(url).toContain('/v1/payments/schedule/res-456');
      expect(options.credentials).toBe('include');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('fetchPaymentHistory', () => {
    it('devrait appeler GET /v1/payments/history et retourner le tableau aligné 1:1 sur le payload NestJS/Prisma', async () => {
      const mockResponse: PaymentHistoryItem[] = [
        {
          id: 'inst-1',
          scheduleId: 'sched-1',
          label: 'Acompte réservation (5%)',
          amount: '2250000',
          dueDate: '2026-09-01T00:00:00.000Z',
          status: 'PAYE',
          paidAt: '2026-08-24T12:00:00.000Z',
          provider: 'STRIPE',
          providerRef: 'TX-inst1-1234',
          createdAt: '2026-08-24T10:00:00.000Z',
          updatedAt: '2026-08-24T12:00:00.000Z',
          schedule: {
            reservation: {
              id: 'res-456',
              unitId: 'unit-789',
            },
          },
        },
      ];

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = fetchSpy;

      const result = await fetchPaymentHistory();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];

      expect(url).toContain('/v1/payments/history');
      expect(options.credentials).toBe('include');
      expect(result).toEqual(mockResponse);
    });
  });
});
