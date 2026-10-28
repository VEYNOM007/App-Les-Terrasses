import { sanitizeSource } from './validation';

/**
 * Source d'acquisition (QR code de flyer, affiche, réseaux…) capturée dès la
 * première visite, puis conservée 90 jours. Le premier `?src=` gagne : un
 * visiteur qui revient par un autre canal reste attribué à son point d'entrée.
 */
export const SOURCE_COOKIE_NAME = 'lt_src';
export const SOURCE_COOKIE_MAX_AGE = 90 * 24 * 60 * 60;

export function readSourceCookie(): string | null {
  if (typeof document === 'undefined') return null;

  const prefix = `${SOURCE_COOKIE_NAME}=`;
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  if (!match) return null;
  return sanitizeSource(decodeURIComponent(match.slice(prefix.length)));
}

export function writeSourceCookie(rawSource: string | null | undefined): string | null {
  if (typeof document === 'undefined') return null;

  const source = sanitizeSource(rawSource);
  if (!source) return readSourceCookie();

  // Premier point d'entrée conservé : ne jamais écraser une source existante.
  if (readSourceCookie()) return readSourceCookie();

  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${SOURCE_COOKIE_NAME}=${encodeURIComponent(source)}; Path=/; Max-Age=${SOURCE_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
  return source;
}
