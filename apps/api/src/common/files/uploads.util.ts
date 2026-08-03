import { NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Racine du stockage local des fichiers téléversés. Le chemin est résolu
 * par rapport au répertoire de travail de l'API (apps/api en dev).
 */
export const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');

const MIME_BY_EXT: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

// Signature PNG : 8 octets fixes (89 50 4E 47 0D 0A 1A 0A). Le magic byte
// est vérifié sur le contenu réel du buffer, jamais sur le Content-Type ou
// l'extension déclarés par le client (Multer seul ne les garantit pas).
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function isPng(buffer: Buffer): boolean {
  return buffer.length >= PNG_MAGIC.length && PNG_MAGIC.every((byte, i) => buffer[i] === byte);
}

/**
 * Résout une `fileUrl` (ex: `/uploads/kyc/xxx.pdf`) en chemin disque
 * absolu + type MIME. Rejette tout chemin sortant de `UPLOAD_ROOT`
 * (traversal) et tout fichier absent du disque.
 */
export function resolveUploadFilePath(fileUrl: string): { absolutePath: string; mimeType: string } {
  const relative = fileUrl.replace(/^\/?uploads\//, '');
  if (relative.includes('..') || path.isAbsolute(relative) || relative.length === 0) {
    throw new NotFoundException('Chemin de document invalide.');
  }

  const absolutePath = path.join(UPLOAD_ROOT, relative);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    throw new NotFoundException('Fichier document introuvable.');
  }

  const ext = path.extname(absolutePath).toLowerCase();
  return { absolutePath, mimeType: MIME_BY_EXT[ext] ?? 'application/octet-stream' };
}
