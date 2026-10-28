'use client';

import { useEffect } from 'react';
import { writeSourceCookie } from '../lib/survey/source';

/**
 * Capte `?src=` (QR code, flyer, affiche…) dès l'arrivée et le conserve en
 * cookie 90 jours. Monté une seule fois dans le layout racine.
 */
export default function SourceCapture() {
  useEffect(() => {
    const source = new URLSearchParams(window.location.search).get('src');
    if (source) writeSourceCookie(source);
  }, []);

  return null;
}
