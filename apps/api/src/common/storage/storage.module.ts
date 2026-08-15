import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';

/**
 * Module global de stockage objet (Backblaze B2). `StorageService` est
 * injectable partout sans ré-import : KYC, contrats PDF et signatures PNG
 * sont le seul périmètre du stockage en base, tous servis via B2.
 */
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
