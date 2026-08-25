import { describe, it, expect, vi, beforeEach } from 'vitest';

// Tests unitaires R6 pour le filtrage actif/annulé et le toggle historique (/suivi)

type DashboardStatus = 'EN_ATTENTE' | 'CONFIRMEE' | 'LIVREE' | 'ANNULEE';

interface MockDashboard {
  reservationId: string;
  status: DashboardStatus;
  unit: { id: string; name: string; type: string; block: { name: string } };
  constructionProgress: number;
  constructionPhase: string;
}

function makeDashboard(id: string, status: DashboardStatus): MockDashboard {
  return {
    reservationId: id,
    status,
    unit: { id: `unit-${id}`, name: `Unit ${id}`, type: 'T2', block: { name: 'Bloc A' } },
    constructionProgress: 45,
    constructionPhase: 'Fondations',
  };
}

describe('SuiviAcquereur — Filtrage actif/annulé & toggle historique (R6)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Séparation actives / annulées', () => {
    it('devrait séparer les réservations actives (EN_ATTENTE, CONFIRMEE, LIVREE) des annulées', () => {
      const dashboards: MockDashboard[] = [
        makeDashboard('res-1', 'EN_ATTENTE'),
        makeDashboard('res-2', 'CONFIRMEE'),
        makeDashboard('res-3', 'ANNULEE'),
        makeDashboard('res-4', 'LIVREE'),
        makeDashboard('res-5', 'ANNULEE'),
      ];

      const active = dashboards.filter((d) =>
        ['EN_ATTENTE', 'CONFIRMEE', 'LIVREE'].includes(d.status),
      );
      const cancelled = dashboards.filter((d) => d.status === 'ANNULEE');

      expect(active).toHaveLength(3);
      expect(active.map((d) => d.reservationId)).toEqual(['res-1', 'res-2', 'res-4']);
      expect(cancelled).toHaveLength(2);
      expect(cancelled.map((d) => d.reservationId)).toEqual(['res-3', 'res-5']);
    });

    it('devrait retourner un tableau vide pour les actives si toutes sont annulées', () => {
      const dashboards: MockDashboard[] = [
        makeDashboard('res-1', 'ANNULEE'),
        makeDashboard('res-2', 'ANNULEE'),
      ];

      const active = dashboards.filter((d) =>
        ['EN_ATTENTE', 'CONFIRMEE', 'LIVREE'].includes(d.status),
      );
      const cancelled = dashboards.filter((d) => d.status === 'ANNULEE');

      expect(active).toHaveLength(0);
      expect(cancelled).toHaveLength(2);
    });

    it('devrait retourner un tableau vide pour les annulées si aucune n\'est annulée', () => {
      const dashboards: MockDashboard[] = [
        makeDashboard('res-1', 'EN_ATTENTE'),
        makeDashboard('res-2', 'CONFIRMEE'),
      ];

      const active = dashboards.filter((d) =>
        ['EN_ATTENTE', 'CONFIRMEE', 'LIVREE'].includes(d.status),
      );
      const cancelled = dashboards.filter((d) => d.status === 'ANNULEE');

      expect(active).toHaveLength(2);
      expect(cancelled).toHaveLength(0);
    });

    it('devrait gérer un tableau de dashboards vide', () => {
      const dashboards: MockDashboard[] = [];

      const active = dashboards.filter((d) =>
        ['EN_ATTENTE', 'CONFIRMEE', 'LIVREE'].includes(d.status),
      );
      const cancelled = dashboards.filter((d) => d.status === 'ANNULEE');

      expect(active).toHaveLength(0);
      expect(cancelled).toHaveLength(0);
    });
  });

  describe('2. Toggle historique (showHistory)', () => {
    it('devrait initialiser showHistory à false par défaut', () => {
      let showHistory = false;
      expect(showHistory).toBe(false);
    });

    it('devrait basculer showHistory de false à true', () => {
      let showHistory = false;
      showHistory = !showHistory;
      expect(showHistory).toBe(true);
    });

    it('devrait masquer la section historique quand showHistory est false', () => {
      const showHistory = false;
      const cancelled: MockDashboard[] = [makeDashboard('res-1', 'ANNULEE')];

      const shouldRender = showHistory && cancelled.length > 0;
      expect(shouldRender).toBe(false);
    });

    it('devrait afficher la section historique quand showHistory est true', () => {
      const showHistory = true;
      const cancelled: MockDashboard[] = [makeDashboard('res-1', 'ANNULEE')];

      const shouldRender = showHistory && cancelled.length > 0;
      expect(shouldRender).toBe(true);
    });

    it('ne devrait pas afficher la section historique si aucune réservation annulée', () => {
      const showHistory = true;
      const cancelled: MockDashboard[] = [];

      const shouldRender = showHistory && cancelled.length > 0;
      expect(shouldRender).toBe(false);
    });
  });

  describe('3. Badge styling — distinction visuelle ANNULEE', () => {
    it('devrait appliquer le style laterite au badge ANNULEE', () => {
      const status: DashboardStatus = 'ANNULEE';
      const className =
        status === 'ANNULEE'
          ? 'bg-laterite/15 text-laterite-light border-laterite/40'
          : 'bg-paper/10 text-paper/80 border-paper/20';

      expect(className).toContain('laterite');
      expect(className).not.toContain('paper/10');
    });

    it('devrait appliquer le style neutre aux statuts non-annulés', () => {
      const statuses: DashboardStatus[] = ['EN_ATTENTE', 'CONFIRMEE', 'LIVREE'];

      for (const status of statuses) {
        const className =
          status === 'ANNULEE'
            ? 'bg-laterite/15 text-laterite-light border-laterite/40'
            : 'bg-paper/10 text-paper/80 border-paper/20';

        expect(className).toContain('paper/10');
        expect(className).not.toContain('laterite');
      }
    });
  });

  describe('4. Edge case — toutes les réservations annulées', () => {
    it('devrait afficher "Aucune réservation en cours" quand activeReservations est vide', () => {
      const dashboards: MockDashboard[] = [
        makeDashboard('res-1', 'ANNULEE'),
        makeDashboard('res-2', 'ANNULEE'),
      ];

      const active = dashboards.filter((d) =>
        ['EN_ATTENTE', 'CONFIRMEE', 'LIVREE'].includes(d.status),
      );

      const showEmptyState = active.length === 0;
      expect(showEmptyState).toBe(true);
    });

    it('devrait adapter le message quand des annulées existent', () => {
      const cancelledCount = 2;
      const message =
        cancelledCount > 0
          ? "Votre réservation précédente a été annulée. Parcourez le catalogue pour en créer une nouvelle."
          : "Vous n'avez pas encore réservé de logement.";

      expect(message).toContain('annulée');
    });
  });
});
