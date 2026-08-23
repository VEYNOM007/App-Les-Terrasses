import { ComplexView } from '../catalogData';
import { CatalogBlockView } from '../api';

/**
 * Convertit une CatalogBlockView (API) en ComplexView (viewer).
 * Les champs optionnels subtitle/description sont normalisés en chaîne vide
 * pour garantir la compatibilité avec le type ComplexView requis par le viewer.
 */
export function catalogBlockViewToComplexView(view: CatalogBlockView): ComplexView {
  return {
    id: view.id,
    title: view.title,
    subtitle: view.subtitle ?? '',
    category: view.category,
    imageUrl: view.imageUrl,
    description: view.description ?? '',
    hotspots: view.hotspots,
  };
}

/**
 * Sélectionne la vue active dans la liste des vues du complexe.
 *
 * Retourne `null` si `views` est vide ou undefined — le composant doit
 * afficher un état de repli (fallback) plutôt que de crasher sur un
 * accès `.title` sur `undefined`.
 *
 * Si `activeId` ne correspond à aucune vue, on retombe sur la première
 * (plutôt que de retourner `undefined` comme le faisait l'ancien
 * `views.find(...) || views[0]` sur un tableau vide).
 */
export function selectActiveView(
  views: ComplexView[] | undefined | null,
  activeId?: string,
): ComplexView | null {
  if (!views || views.length === 0) return null;

  if (activeId) {
    const found = views.find((v) => v.id === activeId);
    if (found) return found;
  }

  return views[0];
}

/**
 * Construit une map blockId → ComplexView[] à partir des blocs d'un projet.
 * Ne conserve que les blocs ayant au moins une vue (filtrage dynamique).
 */
export function buildBlockViewsMap(
  blocks: { id: string; views: CatalogBlockView[] | null }[] | undefined | null,
): Record<string, ComplexView[]> {
  if (!blocks) return {};
  const map: Record<string, ComplexView[]> = {};
  for (const block of blocks) {
    if (block.views && block.views.length > 0) {
      map[block.id] = block.views.map(catalogBlockViewToComplexView);
    }
  }
  return map;
}
