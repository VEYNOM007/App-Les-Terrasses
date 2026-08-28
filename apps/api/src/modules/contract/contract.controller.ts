import { BadRequestException, Body, Controller, Get, Param, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ContractService } from './contract.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user.interface';
import { RegenerateBuyerContractDto } from './dto/regenerate-buyer-contract.dto';

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

  /**
   * Règénère un contrat acheteur (rotation PDF), réservé aux admins.
   * Le service applique la garde en 3 paliers :
   *  - Palier 1 (signé propriétaire) → 409, sans exception.
   *  - Palier 2 (signé admin seul) → 409 tant que `force` n'est pas true.
   *  - Palier 3 (rien de signé) → rotation libre.
   */
  @Post('buyer/:reservationId/regenerate')
  regenerateBuyerContract(
    @Param('reservationId') reservationId: string,
    @Body() body: RegenerateBuyerContractDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.contractService.regenerateBuyerContract(
      reservationId,
      user.id,
      user.role,
      body.force ?? false,
    );
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
