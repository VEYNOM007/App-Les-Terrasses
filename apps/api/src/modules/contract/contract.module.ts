import { Module } from '@nestjs/common';
import { ContractService } from './contract.service';
import { ContractController } from './contract.controller';
import { ContractPdfService } from './contract-pdf.service';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [StorageModule], // d�pendance d�clar�e : PDF + signatures d�pos�s sur B2
  providers: [ContractService, ContractPdfService],
  controllers: [ContractController],
  exports: [ContractService],
})
export class ContractModule {}
