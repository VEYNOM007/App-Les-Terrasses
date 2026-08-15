import { Module } from '@nestjs/common';
import { ContractService } from './contract.service';
import { ContractController } from './contract.controller';
import { ContractPdfService } from './contract-pdf.service';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [StorageModule], // dépendance déclarée : PDF + signatures déposés sur B2
  providers: [ContractService, ContractPdfService],
  controllers: [ContractController],
})
export class ContractModule {}
