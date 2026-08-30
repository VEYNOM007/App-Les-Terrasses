import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { KycService } from './kyc.service';
import { KycDocumentRetentionProcessor } from './kyc-document-retention.processor';

@Module({
  imports: [BullModule.registerQueue({ name: 'kyc-document-retention' })],
  providers: [KycService, KycDocumentRetentionProcessor],
  exports: [KycService],
})
export class KycModule {}