import { describe, expect, it } from 'vitest';
import type { CatalogUnit } from '../api';
import { toNumber } from './catalogue-grid';
import { buildUnitDetailView, unitStatusLabel } from './unit-detail';

function makeUnit(overrides: Partial<CatalogUnit> = {}): CatalogUnit {
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
    marketingDescription: 'Description officielle VEFA.',
    highlights: ['Chambre indépendante', 'Terrasse 8m²'],
    block: { name: 'Bloc A', frontage: 'FACADE_SECONDAIRE' },
    media: [
      { id: 'm-plan', type: 'PLAN', url: '/plan.png', altText: 'Plan', sortOrder: 1 },
      { id: 'm-rendu', type: 'RENDU_3D', url: '/rendu.jpg', altText: 'Rendu 3D', sortOrder: 0 },
      { id: 'm-photo', type: 'PHOTO', url: '/photo.jpg', altText: 'Photo', sortOrder: 2 },
    ],
    ...overrides,
  };
}

describe('buildUnitDetailView', () => {
  it('trie la galerie par sortOrder et marque les RENDU_3D par média', () => {
    const view = buildUnitDetailView(makeUnit());
    expect(view.gallery.map((m) => m.type)).toEqual(['RENDU_3D', 'PLAN', 'PHOTO']);
    expect(view.gallery[0].isRendu3D).toBe(true);
    expect(view.gallery[1].isRendu3D).toBe(false);
  });

  it('reprend planImage avant de retomber sur le média PLAN', () => {
    expect(buildUnitDetailView(makeUnit()).planUrl).toBe('/plan.png');
    expect(buildUnitDetailView(makeUnit({ planImage: '/perso.png' })).planUrl).toBe('/perso.png');
  });

  it('masque la description vide mais garde highlights et surfaces réelles', () => {
    const view = buildUnitDetailView(makeUnit({ marketingDescription: '   ' }));
    expect(view.description).toBeNull();
    expect(view.highlights).toEqual(['Chambre indépendante', 'Terrasse 8m²']);
    expect(view.surfaceM2).toBe(45);
  });

  it('parse le prix string et formate sans double conversion', () => {
    const view = buildUnitDetailView(makeUnit());
    expect(view.priceXOF).toBe(29500000);
    expect(view.priceFormatted.endsWith(' FCFA')).toBe(true);
    expect(view.priceFormatted.replace(/[^\d]/g, '')).toBe('29500000');
  });

  it('dérive canReserve et le badge depuis le statut réel', () => {
    const dispo = buildUnitDetailView(makeUnit());
    expect(dispo.canReserve).toBe(true);
    expect(dispo.statusLabel).toBeNull();

    const vendu = buildUnitDetailView(makeUnit({ status: 'VENDU' }));
    expect(vendu.canReserve).toBe(false);
    expect(vendu.statusLabel).toBe('Vendu');
  });

  it('expose typeLabel, bloc et frontage réels', () => {
    const view = buildUnitDetailView(makeUnit());
    expect(view.typeLabel).toBe('Appartement T2');
    expect(view.blockName).toBe('Bloc A');
    expect(view.blockFrontage).toBe('FACADE_SECONDAIRE');
  });
});

describe('unitStatusLabel', () => {
  it('couvre tous les statuts sans valeur inventée', () => {
    expect(unitStatusLabel('DISPONIBLE')).toBe('Disponible');
    expect(unitStatusLabel('RESERVE')).toBe('Réservé');
    expect(unitStatusLabel('VENDU')).toBe('Vendu');
    expect(unitStatusLabel('LIVRE')).toBe('Livré');
  });
});

describe('toNumber', () => {
  it('rejette proprement un montant non numérique', () => {
    expect(() => toNumber('abc')).toThrow(RangeError);
    expect(() => toNumber('')).toThrow(RangeError);
    expect(() => toNumber('1 000')).toThrow(RangeError);
  });

  it('parse les entiers FCFA (Decimal Prisma en string)', () => {
    expect(toNumber('29500000')).toBe(29500000);
    expect(toNumber('0')).toBe(0);
  });
});
