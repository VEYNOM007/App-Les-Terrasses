import { ComplexView } from '../catalogData';

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
