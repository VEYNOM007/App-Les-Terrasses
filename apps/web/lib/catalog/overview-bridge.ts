import type { TypologyGroup, UnitType } from '../api';
import { selectRepresentativeUnit } from './catalogue-grid';

/**
 * PONT TEMPORAIRE — chantier 2 (fiche unité 3D).
 *
 * L'overview 3D (ComplexOverviewViewer) est encore piloté par le mock
 * localStorage (catalogData.ts) dont les labels de blocs ("Bloc A - Étage
 * 1 à 3", "Bloc C & D - Étage Attique 5", "Façade Nord…") diffèrent des
 * vrais noms en base ("Bloc A", "Bloc B", "Bloc C", "Bloc D").
 *
 * CHANTIER 4 (dédié, ne pas faire ici) : supprimer la source localStorage,
 * piloter ComplexOverviewViewer par `project.views` (hotspots câblés sur les
 * vrais blockId, seed.ts) et SUPPRIMER ce pont ainsi que son matcher.
 * Aucune réutilisation de ce fichier hors chantier 2.
 */

/**
 * Associe un label de bloc mock au nom réel d'un bloc. Règle mot-borne :
 * « Bloc C & D - Étage Attique 5 » → « Bloc C », mais un futur « Bloc 10 »
 * ne matchera pas « Bloc 1 ». Retourne null sans exception pour un label
 * vide ou sans correspondance (hotspot inerte, jamais de fausse fiche).
 */
export function matchRealBlockName(mockLabel: string, realBlockNames: string[]): string | null {
  const label = mockLabel.trim();
  if (label === '') return null;

  const exact = realBlockNames.find((b) => b.trim() === label);
  if (exact !== undefined) return exact.trim();

  return realBlockNames.find((b) => label.startsWith(b.trim() + ' '))?.trim() ?? null;
}

/**
 * Résout l'unité réelle (cuid) ouverte par un hotspot de l'overview.
 *
 * Stratégie : bloc réel matché sur le label mock, puis unité représentative
 * de CE type dans CE bloc (règle unique selectRepresentativeUnit). Aucun
 * repli au niveau typologie : sans bloc, ou sans unité de ce type dans ce
 * bloc, le hotspot est inerte (null). Les appels passent par le console.warn
 * dev de l'appelant pour signaler tout match manquant.
 */
export function resolveOverviewUnitId(
  mockBlockLabel: string,
  mockType: UnitType,
  groups: TypologyGroup[],
): string | null {
  const realBlockNames = Array.from(
    new Set(groups.flatMap((g) => g.units.map((u) => u.blockName))),
  ).sort();

  const blockName = matchRealBlockName(mockBlockLabel, realBlockNames);
  if (blockName === null) return null;

  const candidates = groups.flatMap((g) =>
    g.units.filter((u) => u.blockName === blockName && g.type === mockType),
  );

  return selectRepresentativeUnit(candidates)?.id ?? null;
}
