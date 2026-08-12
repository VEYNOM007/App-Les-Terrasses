import { describe, expect, it } from 'vitest';
import type { CatalogUnit, TypologyGroup, TypologyUnit, UnitMedia } from '../api';
import { mapTypologyToCard, thumbnailMedia } from './catalogue-grid';

function media(type: UnitMedia['type'], sortOrder: number): UnitMedia {
  return { id: `m-${type}-${sortOrder}`, type, url: `/${type}.jpg`, altText: type, sortOrder };
}

function typologyUnit(id: string, status: TypologyUnit['status'] = 'DISPONIBLE'): TypologyUnit {
  return {
    id,
    blockName: 'Bloc A',
    blockFrontage: 'FACADE_SECONDAIRE',
    floor: 2,
    surface: 45,
    price: '29500000',
    status,
    hasRendu3D: false,
  };
}

function unit(overrides: Partial<CatalogUnit> = {}): CatalogUnit {
  return {
    id: 'unit-real-cuid',
    type: 'T2',
    surface: 45,
    floor: 2,
    price: '29500000',
    status: 'DISPONIBLE',
    currency: 'XOF',
    planImage: null,
    virtualTourUrl: null,
    marketingDescription: null,
    highlights: [],
    block: { name: 'Bloc A', frontage: 'FACADE_SECONDAIRE' },
    media: [],
    ...overrides,
  };
}

function group(type: TypologyGroup['type'], units: TypologyUnit[]): TypologyGroup {
  return {
    type,
    totalUnits: units.length,
    availableUnits: units.filter((u) => u.status === 'DISPONIBLE').length,
    minPrice: '1000',
    units,
  };
}

describe('thumbnailMedia', () => {
  it('préfère le RENDU_3D même en dernière position de sortOrder', () => {
    const mediaList = [media('PLAN', 0), media('PHOTO', 1), media('RENDU_3D', 2)];
    expect(thumbnailMedia(mediaList)?.type).toBe('RENDU_3D');
  });

  it('retombe sur la première PHOTO quand il n’y a pas de rendu 3D', () => {
    const mediaList = [media('PLAN', 0), media('PHOTO', 1)];
    expect(thumbnailMedia(mediaList)?.type).toBe('PHOTO');
  });

  it('retourne null si seul un PLAN est présent', () => {
    expect(thumbnailMedia([media('PLAN', 0)])).toBeNull();
  });

  it('retourne null sur une liste vide', () => {
    expect(thumbnailMedia([])).toBeNull();
  });
});

describe('mapTypologyToCard', () => {
  it('active le badge Vue d’artiste quand la miniature est un RENDU_3D', () => {
    const u = unit({
      media: [media('PHOTO', 0), media('PLAN', 1), media('RENDU_3D', 2)],
    });
    const card = mapTypologyToCard(group('T2', [typologyUnit(u.id)]), u);
    expect(card.thumbnailIsRendu3D).toBe(true);
    expect(card.thumbnailUrl).toBe('/RENDU_3D.jpg');
  });

  it('désactive le badge quand la miniature est une PHOTO', () => {
    const u = unit({ media: [media('PHOTO', 0), media('PLAN', 1)] });
    const card = mapTypologyToCard(group('T2', [typologyUnit(u.id)]), u);
    expect(card.thumbnailIsRendu3D).toBe(false);
    expect(card.thumbnailUrl).toBe('/PHOTO.jpg');
  });
});
