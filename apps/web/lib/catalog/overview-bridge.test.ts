import { describe, expect, it } from 'vitest';
import type { TypologyGroup } from '../api';
import { matchRealBlockName, resolveOverviewUnitId } from './overview-bridge';

const REAL_BLOCKS = ['Bloc A', 'Bloc B', 'Bloc C', 'Bloc D'];

describe('matchRealBlockName', () => {
  it('associe un label exact au nom réel', () => {
    expect(matchRealBlockName('Bloc B', REAL_BLOCKS)).toBe('Bloc B');
  });

  it('associe « Bloc C & D - Étage Attique 5 » au bloc « Bloc C » par préfixe', () => {
    expect(matchRealBlockName('Bloc C & D - Étage Attique 5', REAL_BLOCKS)).toBe('Bloc C');
  });

  it('associe « Bloc A - Étage 1 à 3 » au bloc « Bloc A » par préfixe', () => {
    expect(matchRealBlockName('Bloc A - Étage 1 à 3', REAL_BLOCKS)).toBe('Bloc A');
  });

  it('respecte la borne de mot : « Bloc 10 » ne matche pas « Bloc 1 »', () => {
    expect(matchRealBlockName('Bloc 10 - Attique', ['Bloc 1', 'Bloc 10'])).toBe('Bloc 10');
  });

  it('retourne null sans bloc réel correspondant (ex : Façade Nord)', () => {
    expect(matchRealBlockName('Façade Nord - Rez-de-Chaussée', REAL_BLOCKS)).toBeNull();
  });

  it('retourne null sur un label vide ou blanc', () => {
    expect(matchRealBlockName('', REAL_BLOCKS)).toBeNull();
    expect(matchRealBlockName('   ', REAL_BLOCKS)).toBeNull();
  });

  it('ignore les espaces de bordure du label', () => {
    expect(matchRealBlockName('  Bloc B  ', REAL_BLOCKS)).toBe('Bloc B');
  });
});

function group(type: TypologyGroup['type'], units: TypologyGroup['units']): TypologyGroup[] {
  return [
    {
      type,
      totalUnits: units.length,
      availableUnits: units.filter((u) => u.status === 'DISPONIBLE').length,
      minPrice: '29500000',
      units,
    },
  ];
}

const T2_BLOC_A: TypologyGroup['units'] = [
  { id: 'u-a2', blockName: 'Bloc A', blockFrontage: 'FACADE_SECONDAIRE', floor: 2, surface: 45, price: '29500000', status: 'DISPONIBLE', hasRendu3D: false },
  { id: 'u-a1', blockName: 'Bloc A', blockFrontage: 'FACADE_SECONDAIRE', floor: 1, surface: 45, price: '29500000', status: 'RESERVE', hasRendu3D: false },
];

describe('resolveOverviewUnitId', () => {
  it('choisit l\'unité DISPONIBLE du bloc et du type matchés', () => {
    expect(resolveOverviewUnitId('Bloc A - Étage 1 à 4', 'T2', group('T2', T2_BLOC_A))).toBe('u-a2');
  });

  it('sans unité DISPONIBLE, retombe sur la première du bloc (règle VENDU unique)', () => {
    const onlySold: TypologyGroup['units'] = [
      { id: 'u-t5', blockName: 'Bloc C', blockFrontage: 'INTERIEUR_ILOT', floor: 3, surface: 100, price: '55000000', status: 'VENDU', hasRendu3D: true },
    ];
    expect(resolveOverviewUnitId('Bloc C & D - Étage Attique 5', 'T5', group('T5', onlySold))).toBe('u-t5');
  });

  it('retourne null quand le bloc réel n\'existe pas (hotspot inerte)', () => {
    expect(resolveOverviewUnitId('Façade Nord - Rez-de-Chaussée', 'COMMERCE', group('T2', T2_BLOC_A))).toBeNull();
  });

  it('retourne null quand le bloc existe mais pas ce type dedans', () => {
    expect(resolveOverviewUnitId('Bloc A - Étage 1 à 4', 'T5', group('T2', T2_BLOC_A))).toBeNull();
  });

  it('retourne null quand aucun groupe ne fournit de bloc', () => {
    expect(resolveOverviewUnitId('Bloc A - Étage 1 à 4', 'T2', [])).toBeNull();
  });
});
