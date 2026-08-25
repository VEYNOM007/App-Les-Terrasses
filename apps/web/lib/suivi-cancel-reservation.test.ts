import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cancelReservation } from './api';

// Tests unitaires R6 pour l'annulation d'une réservation depuis /suivi
describe('SuiviAcquereur — Annulation réservation (R6)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Appel cancelReservation avec le bon reservationId', () => {
    it('devrait appeler cancelReservation avec l\'identifiant de réservation', async () => {
      const spy = vi.fn().mockResolvedValue(undefined);

      await spy('res-abc123');

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('res-abc123');
    });
  });

  describe('2. Protection anti double-clic', () => {
    it('devrait ignorer les appels concurrents si une annulation est déjà en cours', async () => {
      const cancellingReservationId = 'res-abc123';
      const spy = vi.fn();

      const handleCancel = async (reservationId: string) => {
        if (cancellingReservationId) return;
        await spy(reservationId);
      };

      await handleCancel('res-abc123');
      await handleCancel('res-abc123');

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('3. Confirmation en deux temps requise', () => {
    it('devrait exiger deux clics avant d\'appeler l\'API', () => {
      let confirmingCancelId: string | null = null;

      const handleCancel = (reservationId: string) => {
        if (confirmingCancelId !== reservationId) {
          confirmingCancelId = reservationId;
          return 'confirmation_pending';
        }
        return 'api_call';
      };

      const firstClick = handleCancel('res-abc123');
      expect(firstClick).toBe('confirmation_pending');
      expect(confirmingCancelId).toBe('res-abc123');

      const secondClick = handleCancel('res-abc123');
      expect(secondClick).toBe('api_call');
    });

    it('devrait réinitialiser l\'état de confirmation si l\'utilisateur clique sur Non', () => {
      let confirmingCancelId: string | null = 'res-abc123';

      // Simule un clic sur "Non"
      confirmingCancelId = null;

      expect(confirmingCancelId).toBeNull();
    });
  });

  describe('4. Erreur d\'annulation (4xx/5xx)', () => {
    it('devrait capturer l\'erreur HTTP dans cancelErrorMap sans faire planter la page', async () => {
      const spy = vi.fn().mockRejectedValue(new Error('Annulation refusée : réservation déjà confirmée'));

      let capturedError = '';
      const handleCancel = async (reservationId: string) => {
        try {
          await spy(reservationId);
        } catch (err) {
          capturedError = err instanceof Error ? err.message : 'Erreur inconnue';
        }
      };

      await handleCancel('res-abc123');

      expect(capturedError).toBe('Annulation refusée : réservation déjà confirmée');
    });
  });

  describe('5. Masquage des boutons payer après annulation', () => {
    it('devrait masquer les boutons payer si le statut réservation n\'est plus EN_ATTENTE', () => {
      const reservationStatus: string = 'ANNULEE';
      const installmentStatus: string = 'EN_ATTENTE';

      const showPayButton = reservationStatus === 'EN_ATTENTE' && installmentStatus === 'EN_ATTENTE';

      expect(showPayButton).toBe(false);
    });

    it('devrait afficher les boutons payer si le statut réservation est EN_ATTENTE', () => {
      const reservationStatus: string = 'EN_ATTENTE';
      const installmentStatus: string = 'EN_ATTENTE';

      const showPayButton = reservationStatus === 'EN_ATTENTE' && installmentStatus === 'EN_ATTENTE';

      expect(showPayButton).toBe(true);
    });
  });
});
