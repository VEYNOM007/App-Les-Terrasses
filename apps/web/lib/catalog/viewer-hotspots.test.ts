import { describe, expect, it } from 'vitest';
import { resolveHotspotTarget } from './viewer-hotspots';

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
