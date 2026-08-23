import { describe, expect, it } from 'vitest';
import { selectActiveView, catalogBlockViewToComplexView, buildBlockViewsMap } from './overview-view';
import { ComplexView } from '../catalogData';
import { CatalogBlockView } from '../api';

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

const makeBlockView = (id: string, overrides?: Partial<CatalogBlockView>): CatalogBlockView => ({
  id,
  title: `Bloc View ${id}`,
  category: 'aerial',
  imageUrl: `https://example.com/block-${id}.jpg`,
  subtitle: `Sous-titre ${id}`,
  description: `Description ${id}`,
  hotspots: [{ id: `hs-${id}`, label: `Hotspot ${id}`, targetType: 'UNIT', targetId: 'u1', top: '50%', left: '50%' }],
  ...overrides,
});

describe('catalogBlockViewToComplexView', () => {
  it('convertit une CatalogBlockView complète en ComplexView', () => {
    const input = makeBlockView('b1');
    const result = catalogBlockViewToComplexView(input);
    expect(result.id).toBe('b1');
    expect(result.title).toBe('Bloc View b1');
    expect(result.subtitle).toBe('Sous-titre b1');
    expect(result.description).toBe('Description b1');
    expect(result.imageUrl).toBe('https://example.com/block-b1.jpg');
    expect(result.hotspots).toHaveLength(1);
  });

  it('normalise subtitle undefined en chaîne vide', () => {
    const input = makeBlockView('b2', { subtitle: undefined });
    const result = catalogBlockViewToComplexView(input);
    expect(result.subtitle).toBe('');
  });

  it('normalise description undefined en chaîne vide', () => {
    const input = makeBlockView('b3', { description: undefined });
    const result = catalogBlockViewToComplexView(input);
    expect(result.description).toBe('');
  });

  it('préserve les hotspots avec targetType/targetId', () => {
    const input = makeBlockView('b4', {
      hotspots: [
        { id: 'hs1', label: 'Bloc A', targetType: 'BLOCK', targetId: 'blk-a', top: '30%', left: '20%' },
        { id: 'hs2', label: 'Unité 1', targetType: 'UNIT', targetId: 'u1', top: '60%', left: '40%' },
      ],
    });
    const result = catalogBlockViewToComplexView(input);
    expect(result.hotspots).toHaveLength(2);
    expect(result.hotspots![0].targetType).toBe('BLOCK');
    expect(result.hotspots![1].targetType).toBe('UNIT');
  });
});

describe('buildBlockViewsMap', () => {
  it('retourne un objet vide si blocks est undefined', () => {
    expect(buildBlockViewsMap(undefined)).toEqual({});
  });

  it('retourne un objet vide si blocks est null', () => {
    expect(buildBlockViewsMap(null)).toEqual({});
  });

  it('exclut les blocs sans vues (null)', () => {
    const blocks = [
      { id: 'blk-a', views: [makeBlockView('v1')] },
      { id: 'blk-b', views: null },
    ];
    const map = buildBlockViewsMap(blocks);
    expect(map['blk-a']).toHaveLength(1);
    expect(map['blk-b']).toBeUndefined();
  });

  it('exclut les blocs avec tableau de vues vide', () => {
    const blocks = [
      { id: 'blk-a', views: [makeBlockView('v1')] },
      { id: 'blk-b', views: [] },
    ];
    const map = buildBlockViewsMap(blocks);
    expect(Object.keys(map)).toEqual(['blk-a']);
  });

  it('construit la map correctement pour plusieurs blocs avec vues', () => {
    const blocks = [
      { id: 'blk-a', views: [makeBlockView('va1'), makeBlockView('va2')] },
      { id: 'blk-c', views: [makeBlockView('vc1')] },
    ];
    const map = buildBlockViewsMap(blocks);
    expect(Object.keys(map).sort()).toEqual(['blk-a', 'blk-c']);
    expect(map['blk-a']).toHaveLength(2);
    expect(map['blk-c']).toHaveLength(1);
    expect(map['blk-a'][0].id).toBe('va1');
    expect(map['blk-c'][0].id).toBe('vc1');
  });

  it('applique catalogBlockViewToComplexView sur chaque vue', () => {
    const input = makeBlockView('conv', { subtitle: undefined, description: undefined });
    const blocks = [{ id: 'blk', views: [input] }];
    const map = buildBlockViewsMap(blocks);
    expect(map['blk'][0].subtitle).toBe('');
    expect(map['blk'][0].description).toBe('');
  });
});
