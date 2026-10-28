/**
 * Normalise le paramètre `?redirect=` d'une page de connexion.
 *
 * Seuls les chemins internes sont acceptés. Une URL protocol-relative
 * (`//evil.tld`) ou avec antislash de tête (`/\evil.tld`) sortirait du site :
 * elle est refusée, comme toute valeur absolue.
 */
export function safeRedirect(value: string | null | undefined): string {
  if (!value) return '';
  if (!value.startsWith('/')) return '';
  if (value.startsWith('//')) return '';
  if (value.startsWith('/\\')) return '';
  // Un retour chariot ou un saut de ligne permettrait d'injecter un en-tête.
  if (/[\r\n]/.test(value)) return '';
  return value;
}

/** Vrai si le chemin visé appartient à l'espace promoteur. */
export function isAdminPath(path: string): boolean {
  return path === '/admin' || path.startsWith('/admin/');
}
