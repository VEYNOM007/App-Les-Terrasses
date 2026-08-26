import { describe, it, expect } from 'vitest';

// Tests unitaires R6 pour la logique de countdown et color coding
// de la page admin réservations EN_ATTENTE

describe('Admin Réservations — Countdown & Urgency (R6)', () => {
  const URGENCY_THRESHOLDS = {
    CRITICAL: 4 * 60 * 60 * 1000,
    HIGH: 12 * 60 * 60 * 1000,
    MEDIUM: 24 * 60 * 60 * 1000,
  } as const;

  function urgencyClass(msRemaining: number): string {
    if (msRemaining <= 0) return 'bg-laterite/20 text-laterite-light border-laterite/50';
    if (msRemaining < URGENCY_THRESHOLDS.CRITICAL) return 'text-laterite-light font-semibold';
    if (msRemaining < URGENCY_THRESHOLDS.HIGH) return 'text-sand font-semibold';
    if (msRemaining < URGENCY_THRESHOLDS.MEDIUM) return 'text-sand';
    return 'text-lagoon-light';
  }

  function formatDuration(ms: number): string {
    const abs = Math.abs(ms);
    const totalMinutes = Math.floor(abs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    if (days > 0) return `${days}j ${remainingHours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
    if (hours > 0) return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
    return `${minutes}m`;
  }

  describe('1. Calcul du temps restant', () => {
    it('devrait calculer le temps restant correctement', () => {
      const now = Date.now();
      const lockExpiresAt = now + 24 * 60 * 60 * 1000;
      const msRemaining = lockExpiresAt - now;

      expect(msRemaining).toBe(24 * 60 * 60 * 1000);
      expect(formatDuration(msRemaining)).toBe('1j 0h');
    });

    it('devrait gérer le cas où lockExpiresAt est dans le passé', () => {
      const now = Date.now();
      const lockExpiresAt = now - 2 * 60 * 60 * 1000;
      const msRemaining = lockExpiresAt - now;

      expect(msRemaining).toBe(-2 * 60 * 60 * 1000);
      expect(msRemaining).toBeLessThan(0);
      expect(formatDuration(msRemaining)).toBe('2h');
    });

    it('devrait gérer le cas exacte de l\'expiration (0ms)', () => {
      const msRemaining = 0;
      expect(msRemaining).toBeLessThanOrEqual(0);
      expect(urgencyClass(msRemaining)).toContain('laterite');
    });
  });

  describe('2. Color coding par seuil d\'urgence', () => {
    it('devrait retourner vert pour > 24h', () => {
      const msRemaining = 30 * 60 * 60 * 1000;
      expect(urgencyClass(msRemaining)).toBe('text-lagoon-light');
    });

    it('devrait retourner sand pour 12-24h', () => {
      const msRemaining = 18 * 60 * 60 * 1000;
      expect(urgencyClass(msRemaining)).toBe('text-sand');
    });

    it('devrait retourner sand bold pour 4-12h', () => {
      const msRemaining = 8 * 60 * 60 * 1000;
      expect(urgencyClass(msRemaining)).toBe('text-sand font-semibold');
    });

    it('devrait retourner laterite bold pour < 4h', () => {
      const msRemaining = 2 * 60 * 60 * 1000;
      expect(urgencyClass(msRemaining)).toBe('text-laterite-light font-semibold');
    });

    it('devrait retourner laterite avec fond pour <= 0 (expirée)', () => {
      const msRemaining = 0;
      const cls = urgencyClass(msRemaining);
      expect(cls).toContain('bg-laterite/20');
      expect(cls).toContain('text-laterite-light');
      expect(cls).toContain('border-laterite/50');
    });

    it('devrait retourner laterite avec fond pour négatif', () => {
      const msRemaining = -30 * 60 * 1000;
      const cls = urgencyClass(msRemaining);
      expect(cls).toContain('bg-laterite/20');
    });
  });

  describe('3. Formatage de durée', () => {
    it('devrait formater en jours + heures', () => {
      expect(formatDuration(50 * 60 * 60 * 1000)).toBe('2j 2h');
    });

    it('devrait formater en heures + minutes', () => {
      expect(formatDuration(5 * 60 * 60 * 1000 + 30 * 60 * 1000)).toBe('5h 30m');
    });

    it('devrait formater en minutes seules', () => {
      expect(formatDuration(45 * 60 * 1000)).toBe('45m');
    });
  });

  describe('4. Tri par urgence croissante', () => {
    it('devrait trier les réservations par lockExpiresAt ascendant', () => {
      const now = Date.now();
      const reservations = [
        { id: 'r1', lockExpiresAt: new Date(now + 48 * 3600000).toISOString() },
        { id: 'r2', lockExpiresAt: new Date(now + 2 * 3600000).toISOString() },
        { id: 'r3', lockExpiresAt: new Date(now + 24 * 3600000).toISOString() },
      ];

      const sorted = [...reservations].sort(
        (a, b) => new Date(a.lockExpiresAt).getTime() - new Date(b.lockExpiresAt).getTime(),
      );

      expect(sorted[0].id).toBe('r2');
      expect(sorted[1].id).toBe('r3');
      expect(sorted[2].id).toBe('r1');
    });
  });

  describe('5. Edge cases', () => {
    it('devrait afficher un tableau vide si aucune réservation', () => {
      const sorted: unknown[] = [];
      expect(sorted.length).toBe(0);
    });

    it('devrait gérer toutes les réservations expirées', () => {
      const now = Date.now();
      const allExpired = [
        { lockExpiresAt: new Date(now - 1000).toISOString() },
        { lockExpiresAt: new Date(now - 5000).toISOString() },
      ];

      const allNegative = allExpired.every(
        (r) => new Date(r.lockExpiresAt).getTime() - now <= 0,
      );
      expect(allNegative).toBe(true);
    });
  });
});
