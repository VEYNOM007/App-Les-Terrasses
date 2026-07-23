import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ContractService } from './contract.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('contracts')
export class ContractController {
  constructor(private readonly contractService: ContractService) {}

  @Post('buyer/:reservationId')
  generateBuyerContract(@Param('reservationId') reservationId: string, @Body('fileUrl') fileUrl: string) {
    return this.contractService.generateBuyerContract(reservationId, fileUrl);
  }

  @Post('artisan/:assignmentId')
  generateArtisanContract(@Param('assignmentId') assignmentId: string, @Body('fileUrl') fileUrl: string) {
    return this.contractService.generateArtisanContract(assignmentId, fileUrl);
  }

  @Get('buyer/:reservationId')
  listBuyerContracts(@Param('reservationId') reservationId: string) {
    return this.contractService.listBuyerContracts(reservationId);
  }
}
