import { Module } from '@nestjs/common';
import { ContractService } from './contract.service';
import { ContractController } from './contract.controller';
import { ContractPdfService } from './contract-pdf.service';

@Module({
  providers: [ContractService, ContractPdfService],
  controllers: [ContractController],
})
export class ContractModule {}
