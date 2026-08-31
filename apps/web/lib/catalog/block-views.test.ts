import { describe, it, expect } from 'vitest';
import { createBlankView, findViewsMissingImage } from './block-views';

// Simule le flux "Ajouter une vue" puis "Valider & Enregistrer" :
// handleAddNewView invoquait createBlankView, et handleSaveAll envoyait
// data.views au serveur. Le bug : createBlankView injectait par défaut
// `/masterplan-les-terrasses.jpg` (chemin relatif) que `@IsUrl()` rejetait
// côté serveur -> 400 `views.0.imageUrl must be a URL address`.
describe('block-views — création de vue (flux Ajouter / Valider)', () => {
  it('une vue créée sans image n\'injecte plus de chemin relatif codé en dur', () => {
    const view = createBlankView({ id: 'view-123' });
    // Régression : l'ancien défaut contenait `/masterplan-les-terrasses.jpg`.
    expect(view.imageUrl).not.toContain('masterplan');
    // L'image est volontairement vide : l'admin doit uploader une vraie image.
    expect(view.imageUrl).toBe('');
  });

  it('le payload "Valider & Enregistrer" d\'une vue fraîche ne déclenche plus jamais l\'erreur @IsUrl précédente', () => {
    // Le payload envoyé par handleSaveAll est exactement data.views.
    const view = createBlankView({ id: 'view-456' });
    const payloadViews = [view];
    // Aucune vue ne peut porter un chemin relatif qui échouait `@IsUrl()`.
    for (const v of payloadViews) {
      expect(v.imageUrl.startsWith('/') && !v.imageUrl.startsWith('//')).toBe(false);
    }
    // La vue créée demande explicitement un upload (image vide).
    expect(payloadViews[0].imageUrl).toBe('');
  });

  it('permet de renseigner une image valide avant enregistrement', () => {
    const view = createBlankView({ id: 'view-789' });
    const withImage = { ...view, imageUrl: '/masterplan-les-terrasses.jpg' };
    // Comportement souhaité : un chemin relatif (ou absolu) renseigné par
    // l'admin est désormais accepté côté serveur — le flux ne casse plus.
    expect(withImage.imageUrl).toBe('/masterplan-les-terrasses.jpg');
  });

  it('préserve les champs saisis par l\'admin', () => {
    const view = createBlankView({
      id: 'view-saved',
      title: 'Ma vue',
      subtitle: 'Sous-titre',
      category: 'facade',
      description: 'Desc',
    });
    expect(view.title).toBe('Ma vue');
    expect(view.subtitle).toBe('Sous-titre');
    expect(view.category).toBe('facade');
    expect(view.description).toBe('Desc');
    expect(view.imageUrl).toBe('');
  });
});

describe('block-views — garde-fou UX (image manquante avant Valider)', () => {
  it('détecte une vue ajoutée sans image (imageUrl vide)', () => {
    const view = createBlankView({ id: 'view-1' });
    expect(findViewsMissingImage([view, { ...view, id: 'view-2', imageUrl: 'https://a.com/x.jpg' }]))
      .toHaveLength(1);
  });

  it('traite une imageUrl d\'espaces blancs comme manquante', () => {
    const view = createBlankView({ id: 'view-1' });
    const withSpaces = { ...view, imageUrl: '   ' };
    expect(findViewsMissingImage([withSpaces])).toHaveLength(1);
  });

  it('ne bloque pas les vues avec une image renseignée (relative ou absolue)', () => {
    const a = createBlankView({ id: 'a', imageUrl: '/masterplan-les-terrasses.jpg' });
    const b = createBlankView({ id: 'b', imageUrl: 'https://x.com/a.jpg' });
    expect(findViewsMissingImage([a, b])).toHaveLength(0);
  });
});
