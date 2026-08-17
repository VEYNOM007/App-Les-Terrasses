import { describe, expect, it } from 'vitest';
import { selectActiveView } from './overview-view';
import { ComplexView } from '../catalogData';

const makeView = (id: string, title = `Vue ${id}`): ComplexView => ({
  id,
  title,
  subtitle: `Sous-titre ${id}`,
  category: 'masterplan',
  imageUrl: `https://example.com/${id}.jpg`,
  description: `Description ${id}`,
});

describe('selectActiveView', () => {
  it('retourne null si views est un tableau vide', () => {
    expect(selectActiveView([])).toBeNull();
  });

  it('retourne null si views est undefined', () => {
    expect(selectActiveView(undefined)).toBeNull();
  });

  it('retourne null si views est null', () => {
    expect(selectActiveView(null)).toBeNull();
  });

  it('retourne la première vue si views contient un seul élément et pas d\'activeId', () => {
    const view = makeView('a');
    expect(selectActiveView([view])).toEqual(view);
  });

  it('retourne la vue correspondant à activeId quand il est valide', () => {
    const views = [makeView('a'), makeView('b'), makeView('c')];
    expect(selectActiveView(views, 'b')).toEqual(views[1]);
  });

  it('retombe sur la première vue si activeId ne correspond à rien', () => {
    const views = [makeView('a'), makeView('b')];
    expect(selectActiveView(views, 'inconnu')).toEqual(views[0]);
  });

  it('retombe sur la première vue si activeId est vide', () => {
    const views = [makeView('a'), makeView('b')];
    expect(selectActiveView(views, '')).toEqual(views[0]);
  });

  it('ne retourne jamais undefined sur un tableau non vide', () => {
    const views = [makeView('x')];
    const result = selectActiveView(views);
    expect(result).toBeDefined();
    expect(result?.id).toBe('x');
  });
});
