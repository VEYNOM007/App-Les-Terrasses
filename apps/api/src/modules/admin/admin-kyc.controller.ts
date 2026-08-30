import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { KycService } from '../kyc/kyc.service';
import { RejectKycDto } from '../kyc/dto/reject-kyc.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/kyc')
export class AdminKycController {
  constructor(private readonly kyc: KycService) {}

  /** Liste des dossiers KYC ouverts (pièce la plus récente incluse). */
  @Get()
  list() {
    return this.kyc.listAdminKyc();
  }

  /** URL signée (TTL B2) pour la consultation de la pièce. */
  @Get(':documentId/file')
  file(@Param('documentId') documentId: string) {
    return this.kyc.getDocumentSignedUrl(documentId);
  }

  /** Valide la pièce la plus récente : user → VALIDE. */
  @Post(':documentId/approve')
  approve(@Param('documentId') documentId: string) {
    return this.kyc.approve(documentId);
  }

  /** Rejette avec motif obligatoire : user → REJETE + purge planifiée 15 j. */
  @Post(':documentId/reject')
  reject(@Param('documentId') documentId: string, @Body() body: RejectKycDto) {
    return this.kyc.reject(documentId, body.reason);
  }
}