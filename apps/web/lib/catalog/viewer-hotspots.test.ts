import { describe, expect, it } from 'vitest';
import { createHotspot, resolveHotspotTarget, validateHotspotFormat } from './viewer-hotspots';

describe('resolveHotspotTarget', () => {
  it('retourne uniquement la cible explicitement référencée', () => {
    const targets = [{ id: 'bloc-a' }, { id: 'bloc-b' }];

    expect(resolveHotspotTarget('bloc-b', targets)).toEqual({ id: 'bloc-b' });
  });

  it('retourne null sans cible valide et ne retombe jamais sur la première cible', () => {
    const targets = [{ id: 'bloc-a' }, { id: 'bloc-b' }];

    expect(resolveHotspotTarget('bloc-inconnu', targets)).toBeNull();
  });
});

describe('validateHotspotFormat', () => {
  it('accepte le format targetType/targetId', () => {
    expect(validateHotspotFormat({ targetType: 'UNIT', targetId: 'unit-a' })).toBe(true);
  });

  it('accepte targetType BLOCK', () => {
    expect(validateHotspotFormat({ targetType: 'BLOCK', targetId: 'bloc-a' })).toBe(true);
  });

  it("rejette l'ancien format targetBlockId", () => {
    expect(validateHotspotFormat({ targetBlockId: 'unit-a' })).toBe(false);
  });

  it('rejette un targetType invalide', () => {
    expect(validateHotspotFormat({ targetType: 'FOO', targetId: 'x' })).toBe(false);
  });

  it('rejette un targetId vide', () => {
    expect(validateHotspotFormat({ targetType: 'UNIT', targetId: '' })).toBe(false);
  });
});

describe('createHotspot', () => {
  it('retourne le format complet avec targetType et targetId', () => {
    expect(
      createHotspot({ id: 'hs-1', label: 'Test', top: '50%', left: '50%', targetType: 'BLOCK', targetId: 'bloc-a' }),
    ).toEqual({
      id: 'hs-1',
      label: 'Test',
      top: '50%',
      left: '50%',
      targetType: 'BLOCK',
      targetId: 'bloc-a',
    });
  });

  it('default à targetType UNIT si non fourni', () => {
    const hotspot = createHotspot({ id: 'hs-1', label: 'Test', top: '50%', left: '50%' });

    expect(hotspot.targetType).toBe('UNIT');
  });

  it('default à targetId vide si non fourni', () => {
    const hotspot = createHotspot({ id: 'hs-1', label: 'Test', top: '50%', left: '50%' });

    expect(hotspot.targetId).toBe('');
  });
});
