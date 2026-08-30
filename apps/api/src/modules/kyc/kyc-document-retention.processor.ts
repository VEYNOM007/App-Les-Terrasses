import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { KycService } from './kyc.service';

export interface KycDocumentRetentionJobData {
  documentId: string;
}

/**
 * Job différé planifié au moment du rejet (delay 15 jours, jobId = documentId,
 * même pattern que l'expiration des réservations à 48h). La logique de purge a
 * une garantie idempotente (re-vérification de l'état réel du document) et une
 * garantie de retry BullMQ si la suppression échoue.
 */
@Processor('kyc-document-retention')
export class KycDocumentRetentionProcessor extends WorkerHost {
  constructor(private readonly kyc: KycService) {
    super();
  }

  async process(job: Job<KycDocumentRetentionJobData>): Promise<void> {
    await this.kyc.purgeRejectedDocument(job.data.documentId);
  }
}