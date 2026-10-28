import { describe, expect, it } from 'vitest';
import { isAdminPath, safeRedirect } from './safe-redirect';

describe('safeRedirect', () => {
  it('accepte un chemin interne', () => {
    expect(safeRedirect('/suivi')).toBe('/suivi');
    expect(safeRedirect('/admin/catalogue')).toBe('/admin/catalogue');
    expect(safeRedirect('/admin/catalogue?onglet=plans')).toBe(
      '/admin/catalogue?onglet=plans',
    );
  });

  it('refuse une URL absolue', () => {
    expect(safeRedirect('https://evil.tld')).toBe('');
    expect(safeRedirect('javascript:alert(1)')).toBe('');
  });

  it('refuse une URL protocol-relative', () => {
    expect(safeRedirect('//evil.tld')).toBe('');
    expect(safeRedirect('/\\evil.tld')).toBe('');
  });

  it('refuse une valeur vide ou absente', () => {
    expect(safeRedirect('')).toBe('');
    expect(safeRedirect(null)).toBe('');
    expect(safeRedirect(undefined)).toBe('');
  });

  it('refuse un saut de ligne', () => {
    expect(safeRedirect('/suivi\r\nSet-Cookie: x=1')).toBe('');
  });
});

describe('isAdminPath', () => {
  it('reconnait l’espace promoteur', () => {
    expect(isAdminPath('/admin')).toBe(true);
    expect(isAdminPath('/admin/catalogue')).toBe(true);
  });

  it('ne confond pas un chemin voisin', () => {
    expect(isAdminPath('/administrateur')).toBe(false);
    expect(isAdminPath('/suivi')).toBe(false);
    expect(isAdminPath('')).toBe(false);
  });
});
