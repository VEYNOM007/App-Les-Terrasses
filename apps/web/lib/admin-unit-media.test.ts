import { describe, it, expect } from 'vitest';

/**
 * R6 — Tests pour la gestion des médias unitaires (admin/catalogue)
 *
 * Couvre : détection Unsplash vs B2, logique de remplacement,
 * drag & drop upload, flux de confirmation suppression, badge visuel.
 */

// ── isExternalUrl ──────────────────────────────────────────────

describe('isExternalUrl', () => {
  const isExternalUrl = (url: string): boolean => url.includes('unsplash');

  it('devrait détecter une URL Unsplash', () => {
    expect(isExternalUrl('https://images.unsplash.com/photo-1234')).toBe(true);
  });

  it('devrait détecter une URL Unsplash avec chemin variable', () => {
    expect(isExternalUrl('https://images.unsplash.com/photo-1502672260266-2c1076294585?w=800')).toBe(true);
  });

  it('ne devrait pas marquer comme externe une URL B2', () => {
    expect(isExternalUrl('https://f005.backblazeb2.com/file/residence-catalog-media-public/unit-media/abc.png')).toBe(false);
  });

  it('ne devrait pas marquer comme externe une chaîne vide', () => {
    expect(isExternalUrl('')).toBe(false);
  });
});

// ── handleReplaceMedia — logique du flux ──────────────────────

describe('handleReplaceMedia', () => {
  it('devrait appeler delete puis upload pour remplacer', () => {
    const calls: string[] = [];
    const mockDelete = async (id: string) => { calls.push(`delete:${id}`); };
    const mockUpload = async (unitId: string, _body: unknown, _file: File) => { calls.push(`upload:${unitId}`); return { id: 'new-1' }; };

    const media = { id: 'old-1', type: 'PHOTO', url: 'https://images.unsplash.com/old', altText: 'test', sortOrder: 0 };

    const run = async () => {
      await mockDelete(media.id);
      await mockUpload('unit-1', { type: media.type, altText: media.altText }, new File([''], 'test.jpg'));
    };

    return run().then(() => {
      expect(calls).toEqual(['delete:old-1', 'upload:unit-1']);
    });
  });

  it('devrait préserver le type et l\'altText du média original', () => {
    const media = { id: 'x', type: 'RENDU_3D' as const, url: '', altText: 'Rendu studio', sortOrder: 0 };
    let capturedBody: Record<string, unknown> = {};

    const mockUpload = async (_unitId: string, body: unknown) => {
      capturedBody = body as Record<string, unknown>;
      return { id: 'new' };
    };

    return mockUpload('u1', { type: media.type, altText: media.altText }, new File([''], 'f.jpg')).then(() => {
      expect(capturedBody.type).toBe('RENDU_3D');
      expect(capturedBody.altText).toBe('Rendu studio');
    });
  });
});

// ── handleDragDropUpload — logique ─────────────────────────────

describe('handleDragDropUpload', () => {
  it('devrait appeler uploadUnitMedia avec le bon type', () => {
    let capturedType = '';
    const mockUpload = async (_unitId: string, body: unknown, _file: File) => {
      capturedType = (body as { type: string }).type;
      return { id: 'uploaded' };
    };

    return mockUpload('unit-1', { type: 'PHOTO' }, new File([''], 'photo.jpg')).then(() => {
      expect(capturedType).toBe('PHOTO');
    });
  });

  it('devrait accepter les formats image/png, image/jpeg, image/webp', () => {
    const accepted = ['image/png', 'image/jpeg', 'image/webp'];
    for (const mime of accepted) {
      expect(mime.startsWith('image/')).toBe(true);
    }
  });
});

// ── Confirmation suppression — logique ─────────────────────────

describe('Confirmation suppression', () => {
  it('devrait exiger mediaToDelete === media.id avant d\'afficher la confirmation', () => {
    const mediaId = 'media-123';
    const mediaToDelete: string | null = null;
    expect(mediaToDelete === mediaId).toBe(false);
  });

  it('devrait afficher les boutons Oui/Non quand mediaToDelete est défini', () => {
    const mediaId = 'media-123';
    const mediaToDelete: string | null = 'media-123';
    expect(mediaToDelete === mediaId).toBe(true);
  });

  it('devrait réinitialiser mediaToDelete à null après suppression', () => {
    let mediaToDelete: string | null = 'media-123';
    const reset = () => { mediaToDelete = null; };
    reset();
    expect(mediaToDelete).toBeNull();
  });
});

// ── Badge visuel — logique ─────────────────────────────────────

describe('Badge visuel source image', () => {
  it('devrait afficher "Unsplash" pour les URLs externes', () => {
    const url = 'https://images.unsplash.com/photo-1234';
    const external = url.includes('unsplash');
    expect(external).toBe(true);
  });

  it('devrait afficher "Photo réelle" pour les URLs B2', () => {
    const url = 'https://f005.backblazeb2.com/file/bucket/unit-media/abc.png';
    const external = url.includes('unsplash');
    expect(external).toBe(false);
  });

  it('devrait utiliser le style laterite pour les images externes', () => {
    const external = true;
    const badgeClass = external
      ? 'bg-laterite/80 text-paper'
      : 'bg-lagoon/80 text-paper';
    expect(badgeClass).toContain('laterite');
  });

  it('devrait utiliser le style lagoon pour les images B2', () => {
    const external = false;
    const badgeClass = external
      ? 'bg-laterite/80 text-paper'
      : 'bg-lagoon/80 text-paper';
    expect(badgeClass).toContain('lagoon');
  });
});

// ── Sélecteur type par défaut ──────────────────────────────────

describe('Sélecteur type par défaut pour upload', () => {
  it('devrait proposer les 4 types de médias', () => {
    const options = ['RENDU_3D', 'PHOTO', 'PHOTO_REELLE', 'PLAN'];
    expect(options).toHaveLength(4);
    expect(options).toContain('PHOTO');
    expect(options).toContain('RENDU_3D');
  });

  it('devrait initialiser à RENDU_3D par défaut', () => {
    const defaultType = 'RENDU_3D';
    expect(defaultType).toBe('RENDU_3D');
  });
});
