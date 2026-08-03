import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ContractService } from './contract.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user.interface';

@UseGuards(JwtAuthGuard)
@Controller('contracts')
export class ContractController {
  constructor(private readonly contractService: ContractService) {}

  @Post('buyer/:reservationId')
  generateBuyerContract(
    @Param('reservationId') reservationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.contractService.generateBuyerContract(reservationId, user.id, user.role);
  }

  @Post('artisan/:assignmentId')
  generateArtisanContract(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.contractService.generateArtisanContract(assignmentId, user.id, user.role);
  }

  @Get('buyer/:reservationId')
  listBuyerContracts(@Param('reservationId') reservationId: string, @CurrentUser() user: AuthUser) {
    return this.contractService.listBuyerContracts(reservationId, user.id, user.role);
  }
}
