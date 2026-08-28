import { BadRequestException, Controller, Get, Param, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ContractService } from './contract.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user.interface';

const SIGNATURE_MAX_SIZE = 2 * 1024 * 1024; // 2 Mo

/**
 * Interceptor multipart : le buffer est conservé en mémoire — le magic byte
 * PNG réel est vérifié dans ContractService avant toute écriture sur disque.
 */
const signatureFileInterceptor = FileInterceptor('signature', {
  storage: memoryStorage(),
  limits: { fileSize: SIGNATURE_MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'image/png') {
      cb(new BadRequestException('Format non supporté : PNG uniquement.'), false);
      return;
    }
    cb(null, true);
  },
});

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

  @Post(':documentId/sign')
  @UseInterceptors(signatureFileInterceptor)
  signContract(
    @Param('documentId') documentId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('Fichier de signature manquant.');
    const userAgent = req.headers['user-agent'] ?? '';
    return this.contractService.signContract(documentId, user.id, user.role, file.buffer, req.ip, userAgent);
  }
}
