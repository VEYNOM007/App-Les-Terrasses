import { registerDecorator, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

/**
 * Valide une valeur qui référence une image du catalogue, sous l'une des
 * deux formes légitimes :
 *
 *   1. une URL absolue valide (ex. `https://immo-les-terrasse.com/x.jpg`), ou
 *   2. un chemin relatif servie par le site (ex. `/masterplan-les-terrasse.jpg`).
 *
 * Pourquoi ce validateur plutôt que `@IsUrl({ require_tld: false })` ?
 * `validator.isURL` ne considère JAMAIS un chemin relatif comme une URL
 * valide, même avec `require_tld: false` : on teste ici
 * `isURL('/a.jpg', { require_tld: false })` → `false`. Le flag ne tolère que
 * l'absence de TLD (`http://localhost`), pas les chemins relatifs. Les images
 * du catalogue sont pourtant légitimement référencées en relatif
 * (`/masterplan-les-terrasses.jpg`) comme en absolu. `@IsUrl` rejetait donc
 * systématiquement ces ressources internes (régression `views.0.imageUrl`).
 *
 * Réutilisable si on veut harmoniser un jour `coverImage`, `siteMapImageUrl`
 * ou `virtualTourUrl` (hors périmètre de ce fix : on ne touche que les vues).
 */
@ValidatorConstraint({ name: 'isImageUrlOrPath', async: false })
export class IsImageUrlOrPathConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (trimmed.length === 0) return false;

    // Chemin relatif : commence par un seul `/`, sans espace blanc (jamais
    // présent dans une URL ou un chemin réel de ressources). `//...` est un
    // URL protocol-relative, pas un chemin local — on le rejette.
    if (trimmed.startsWith('/')) {
      return !trimmed.startsWith('//') && !/\s/.test(trimmed);
    }

    // URL absolue : le constructeur natif URL lève pour toute chaîne qui
    // n'est pas une URL de premier niveau correctement formée. Retombe sur
    // le comportement natif de Node — zéro dépendance nouvelle.
    try {
      new URL(trimmed);
      return true;
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return 'doit être une URL absolue valide (https://…) ou un chemin relatif (/…).';
  }
}

export function IsImageUrlOrPath(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsImageUrlOrPathConstraint,
    });
  };
}
