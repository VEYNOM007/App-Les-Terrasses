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
