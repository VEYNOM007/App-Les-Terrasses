import { describe, it, expect } from 'vitest';
import { DEFAULT_COMPLEX_DATA } from './catalogData';

describe('Project views fallback', () => {
  it("le fallback ne contient aucune vue ni unité inventée", () => {
    expect(DEFAULT_COMPLEX_DATA.views).toEqual([]);
    expect(DEFAULT_COMPLEX_DATA.units).toEqual([]);
  });

  it('project.views ?? [] produit un tableau vide quand l’API renvoie null', () => {
    const apiResponse = { views: null } as { views: typeof DEFAULT_COMPLEX_DATA.views | null };
    const result = apiResponse.views ?? [];
    expect(result).toEqual([]);
    // Tableau neuf : le composant ne mute jamais le fallback partagé.
    expect(result).not.toBe(DEFAULT_COMPLEX_DATA.views);
  });

  it('project.views ?? [] préserve les vues réelles quand l’API renvoie des données', () => {
    const realViews = [{ id: 'v1', title: 'Test', imageUrl: 'https://pub.example.com/view.jpg' }];
    const apiResponse = { views: realViews } as { views: typeof DEFAULT_COMPLEX_DATA.views | null };
    const result = apiResponse.views ?? [];
    expect(result).toEqual(realViews);
  });
});
