import type { ComplexView } from '../catalogData';

/**
 * Crée une vue "à blanc" pour l'éditeur admin — utilisée par
 * `handleAddNewView`. L'`imageUrl` est volontairement vide : aucune fausse
 * ressource n'est injectée par défaut. L'admin doit uploader une vraie image
 * (ou saisir une URL valide) avant d'enregistrer.
 *
 * Pourquoi pas une valeur par défaut non vide ? L'ancien défaut était
 * `/masterplan-les-terrasses.jpg` (chemin relatif codé en dur). Côté serveur,
 * `@IsUrl()` le rejettait en 400 (`views.0.imageUrl must be a URL address`),
 * alors que les vues sont légitimement servies en relatif ou en absolu. Forcer
 * l'upload dès la création rend l'état incomplet visible immédiatement, plutôt
 * que de faire planter la sauvegarde au moment où Moussa clique "Valider".
 */
export function createBlankView(
  partial: Pick<ComplexView, 'id'> & Partial<ComplexView>,
): ComplexView {
  return {
    id: partial.id,
    title: partial.title ?? 'Nouvelle Vue HD',
    subtitle: partial.subtitle ?? 'Description courte de la vue',
    category: partial.category ?? 'aerial',
    imageUrl: partial.imageUrl ?? '',
    description: partial.description ?? 'Détails de cette vue d\'ensemble...',
    hotspots: partial.hotspots ?? [],
  };
}

/**
 * Retourne les vues sans image (imageUrl vide ou blanche). Utilisé par
 * l'éditeur admin pour bloquer la sauvegarde AVANT l'appel réseau, avec un
 * message utilisateur clair, plutôt que de laisser le serveur renvoyer un 400
 * technique (« doit être une URL absolue… ») peu intelligible pour l'admin.
 */
export function findViewsMissingImage(views: ComplexView[]): ComplexView[] {
  return views.filter((v) => v.imageUrl.trim().length === 0);
}
