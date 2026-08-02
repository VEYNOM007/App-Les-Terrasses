import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ArtisanService, SubmitQuoteDto } from './artisan.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user.interface';

@UseGuards(JwtAuthGuard)
@Controller('artisans')
export class ArtisanController {
  constructor(private readonly artisanService: ArtisanService) {}

  /**
   * Toutes les routes /artisans/* exigent un profil Artisan lié au compte.
   * `user.artisanId` est résolu par JwtStrategy (lookup Prisma) ; s'il est
   * null, l'appelant n'est pas un artisan → 403.
   */
  private requireArtisanId(user: AuthUser): string {
    if (!user.artisanId) {
      throw new ForbiddenException('Profil artisan requis pour accéder à cette ressource');
    }
    return user.artisanId;
  }

  @Get('me/assignments')
  myAssignments(@CurrentUser() user: AuthUser) {
    return this.artisanService.getMyAssignments(this.requireArtisanId(user));
  }

  @Post('assignments/:id/respond')
  respond(@Param('id') id: string, @Body('accept') accept: boolean, @CurrentUser() user: AuthUser) {
    return this.artisanService.respondToAssignment(id, this.requireArtisanId(user), accept);
  }

  @Get('blocks/:blockId/planning')
  planning(@Param('blockId') blockId: string, @CurrentUser() user: AuthUser) {
    return this.artisanService.getBlockPlanning(this.requireArtisanId(user), blockId);
  }

  @Get('blocks/:blockId/client-contacts')
  contacts(@Param('blockId') blockId: string, @CurrentUser() user: AuthUser) {
    return this.artisanService.getBlockClientContacts(this.requireArtisanId(user), blockId);
  }

  @Post('blocks/:blockId/quotes')
  submitQuote(
    @Param('blockId') blockId: string,
    @Body() body: SubmitQuoteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.artisanService.submitQuote(this.requireArtisanId(user), blockId, body);
  }

  @Get('me/quotes')
  myQuotes(@CurrentUser() user: AuthUser) {
    return this.artisanService.getMyQuotes(this.requireArtisanId(user));
  }
}
