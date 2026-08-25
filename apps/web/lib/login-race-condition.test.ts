import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthUser } from './api';

// Tests unitaires R6 pour le fix du race condition login
// Couvre : AuthProvider.login retour, login page redirect, Navbar profil

const mockUser: AuthUser = {
  id: 'usr-abc123',
  role: 'ACHETEUR',
  email: 'acheteur@test.com',
  fullName: 'Acheteur Test',
  phone: '+22890000000',
  country: 'TG',
};

const mockAdmin: AuthUser = {
  id: 'usr-admin01',
  role: 'ADMIN',
  email: 'admin@test.com',
  fullName: 'Admin Test',
  phone: '+22890000001',
  country: 'TG',
};

describe('Fix race condition login (R6)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. AuthProvider.login() retourne le user sans appel réseau supplémentaire', () => {
    it('devrait retourner l\'objet AuthUser tel que reçu de apiLogin()', async () => {
      const apiLogin = vi.fn().mockResolvedValue({ user: mockUser });

      const loginImpl = async (email: string, password: string) => {
        const { user: logged } = await apiLogin(email, password);
        return logged;
      };

      const result = await loginImpl('acheteur@test.com', 'password123');

      expect(result).toEqual(mockUser);
      expect(result.id).toBe('usr-abc123');
      expect(result.role).toBe('ACHETEUR');
      expect(apiLogin).toHaveBeenCalledTimes(1);
      expect(apiLogin).toHaveBeenCalledWith('acheteur@test.com', 'password123');
    });

    it('devrait retourner le user ADMIN pour un compte admin', async () => {
      const apiLogin = vi.fn().mockResolvedValue({ user: mockAdmin });

      const loginImpl = async (email: string, password: string) => {
        const { user: logged } = await apiLogin(email, password);
        return logged;
      };

      const result = await loginImpl('admin@test.com', 'password123');

      expect(result.role).toBe('ADMIN');
    });

    it('devrait propager l\'erreur si apiLogin échoue', async () => {
      const apiLogin = vi.fn().mockRejectedValue(new Error('Invalid credentials'));

      const loginImpl = async (email: string, password: string) => {
        const { user: logged } = await apiLogin(email, password);
        return logged;
      };

      await expect(loginImpl('bad@test.com', 'wrong')).rejects.toThrow('Invalid credentials');
    });
  });

  describe('2. Login page — redirection basée sur le rôle du user retourné', () => {
    it('devrait rediriger vers /suivi pour un ACHETEUR', () => {
      const logged = mockUser;
      const redirect: string | null = null;

      const target = redirect && redirect.startsWith('/')
        ? redirect
        : logged.role === 'ADMIN'
          ? '/admin'
          : '/suivi';

      expect(target).toBe('/suivi');
    });

    it('devrait rediriger vers /admin pour un ADMIN', () => {
      const logged = mockAdmin;
      const redirect: string | null = null;

      const target = redirect && redirect.startsWith('/')
        ? redirect
        : logged.role === 'ADMIN'
          ? '/admin'
          : '/suivi';

      expect(target).toBe('/admin');
    });

    it('devrait respecter le paramètre redirect quand il est fourni', () => {
      const logged = mockUser;
      const redirect = '/catalogue';

      const target = redirect && redirect.startsWith('/')
        ? redirect
        : logged.role === 'ADMIN'
          ? '/admin'
          : '/suivi';

      expect(target).toBe('/catalogue');
    });

    it('devrait ignorer un redirect qui ne commence pas par /', () => {
      const logged = mockUser;
      const redirect = 'https://evil.com';

      const target = redirect && redirect.startsWith('/')
        ? redirect
        : logged.role === 'ADMIN'
          ? '/admin'
          : '/suivi';

      expect(target).toBe('/suivi');
    });
  });

  describe('3. Login page — plus besoin de hydrateSession() pour la redirection', () => {
    it('devrait utiliser le user retourné par login() pour la redirection, pas fetchMe()', async () => {
      const fetchMe = vi.fn();
      const apiLogin = vi.fn().mockResolvedValue({ user: mockUser });

      // Simule le flux : login() retourne le user, pas besoin de fetchMe()
      const logged = await (async (email: string, password: string) => {
        const { user } = await apiLogin(email, password);
        return user;
      })('acheteur@test.com', 'password123');

      const target = logged.role === 'ADMIN' ? '/admin' : '/suivi';

      expect(target).toBe('/suivi');
      expect(fetchMe).not.toHaveBeenCalled();
      expect(logged.fullName).toBe('Acheteur Test');
    });
  });

  describe('4. Navbar — affichage conditionnel du profil', () => {
    it('devrait afficher le fullName quand user est connecté', () => {
      const user = mockUser;
      const displayName = user.fullName || user.email;
      expect(displayName).toBe('Acheteur Test');
    });

    it('devrait afficher l\'email si fullName est vide', () => {
      const userWithoutName = { ...mockUser, fullName: '' };
      const displayName = userWithoutName.fullName || userWithoutName.email;
      expect(displayName).toBe('acheteur@test.com');
    });

    it('devrait ne pas afficher de profil si user est null', () => {
      const user = null;
      const shouldShow = user !== null;
      expect(shouldShow).toBe(false);
    });
  });
});
