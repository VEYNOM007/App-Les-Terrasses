import { Controller, Get, Param, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { createReadStream } from 'fs';
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

  @Get('documents/:documentId/download')
  async downloadDocument(
    @Param('documentId') documentId: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { absolutePath, mimeType } = await this.portalService.getDocumentFile(documentId, user.id);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="document${mimeType === 'application/pdf' ? '.pdf' : ''}"`,
    });
    return new StreamableFile(createReadStream(absolutePath));
  }
}
