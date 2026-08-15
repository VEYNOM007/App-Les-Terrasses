import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PortalService } from './portal.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user.interface';

@UseGuards(JwtAuthGuard)
@Controller('portal')
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Get('dashboard')
  getDashboard(@CurrentUser() user: AuthUser) {
    return this.portalService.getDashboard(user.id);
  }

  @Get('documents')
  listDocuments(@CurrentUser() user: AuthUser) {
    return this.portalService.listDocuments(user.id);
  }

  /**
   * Renvoie une URL signée (B2) que le navigateur télécharge directement.
   * L'appartenance du document est vérifiée côté serveur (getDocumentFile).
   */
  @Get('documents/:documentId/download')
  downloadDocument(@Param('documentId') documentId: string, @CurrentUser() user: AuthUser) {
    return this.portalService.getDocumentFile(documentId, user.id);
  }
}
