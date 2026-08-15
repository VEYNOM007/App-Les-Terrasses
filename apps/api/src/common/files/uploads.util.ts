/**
 * Signature PNG : 8 octets fixes (89 50 4E 47 0D 0A 1A 0A). Le magic byte
 * est vérifié sur le contenu réel du buffer, jamais sur le Content-Type ou
 * l'extension déclarés par le client (Multer seul ne les garantit pas).
 *
 * Le stockage des fichiers (KYC, contrats PDF, signatures) est géré par
 * StorageService (Backblaze B2) — plus aucune écriture sur disque ici.
 */
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function isPng(buffer: Buffer): boolean {
  return buffer.length >= PNG_MAGIC.length && PNG_MAGIC.every((byte, i) => buffer[i] === byte);
}
