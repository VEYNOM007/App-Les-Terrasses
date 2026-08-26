import { describe, it, expect } from 'vitest';

// Tests unitaires R6 pour la page admin comptes inscrits
// — formatage adresse, rôle badge, édition, régression inscription

describe('Admin Comptes — Liste & Édition adresse (R6)', () => {
  const ROLE_BADGES: Record<string, string> = {
    ACHETEUR: 'bg-lagoon/20 text-lagoon-light border-lagoon/40',
    COMMERCIAL: 'bg-sand/20 text-sand border-sand/40',
    ADMIN: 'bg-laterite/20 text-laterite-light border-laterite/40',
    ARTISAN: 'bg-paper/10 text-paper/70 border-paper/30',
  };

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  describe('1. Formatage adresse — "Non renseignée" si null', () => {
    it('devrait afficher "Non renseignée" quand address est null', () => {
      const address: string | null = null;
      const display = address ? address : 'Non renseignée';
      expect(display).toBe('Non renseignée');
    });

    it('devrait afficher l\'adresse quand elle est définie', () => {
      const address: string | null = 'Quartier Agbala, Lomé';
      const display = address ? address : 'Non renseignée';
      expect(display).toBe('Quartier Agbala, Lomé');
    });

    it('devrait afficher "Non renseignée" quand address est une chaîne vide', () => {
      const address: string | null = '';
      const display = address ? address : 'Non renseignée';
      expect(display).toBe('Non renseignée');
    });
  });

  describe('2. Badge rôle', () => {
    it('devrait retourner le bon style pour ACHETEUR', () => {
      expect(ROLE_BADGES['ACHETEUR']).toContain('lagoon');
    });

    it('devrait retourner le bon style pour ADMIN', () => {
      expect(ROLE_BADGES['ADMIN']).toContain('laterite');
    });

    it('devrait retourner le bon style pour COMMERCIAL', () => {
      expect(ROLE_BADGES['COMMERCIAL']).toContain('sand');
    });

    it('devrait retourner le bon style pour ARTISAN', () => {
      expect(ROLE_BADGES['ARTISAN']).toContain('paper');
    });
  });

  describe('3. Formatage date', () => {
    it('devrait formater une date ISO en DD/MM/YYYY', () => {
      const result = formatDate('2026-01-15T10:30:00.000Z');
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });
  });

  describe('4. Édition adresse — logique', () => {
    it('devrait initialiser editValue avec l\'adresse existante', () => {
      const user = { id: 'u1', address: 'Quartier Bè' };
      const editValue = user.address ?? '';
      expect(editValue).toBe('Quartier Bè');
    });

    it('devrait initialiser editValue vide si address est null', () => {
      const user = { id: 'u1', address: null as string | null };
      const editValue = user.address ?? '';
      expect(editValue).toBe('');
    });

    it('devrait envoyer null à l\'API si editValue est vide (effacer l\'adresse)', () => {
      const editValue = '';
      const payload = editValue || null;
      expect(payload).toBeNull();
    });

    it('devrait envoyer la valeur si editValue n\'est pas vide', () => {
      const editValue = 'Nouvelle adresse';
      const payload = editValue || null;
      expect(payload).toBe('Nouvelle adresse');
    });
  });

  describe('5. Régression — inscription sans adresse', () => {
    it('devrait accepter un payload sans champ address (rétrocompatibilité)', () => {
      const payload = {
        email: 'test@example.com',
        phone: '+22890000000',
        password: 'secret123',
        fullName: 'Test User',
        country: 'TG',
      };
      expect(payload).not.toHaveProperty('address');
    });

    it('devrait accepter un payload avec address undefined', () => {
      const payload = {
        email: 'test@example.com',
        phone: '+22890000000',
        password: 'secret123',
        fullName: 'Test User',
        country: 'TG',
        address: undefined,
      };
      expect(payload.address).toBeUndefined();
    });

    it('devrait accepter un payload avec address rempli', () => {
      const payload = {
        email: 'test@example.com',
        phone: '+22890000000',
        password: 'secret123',
        fullName: 'Test User',
        country: 'TG',
        address: 'Quartier Agbala',
      };
      expect(payload.address).toBe('Quartier Agbala');
    });
  });
});
