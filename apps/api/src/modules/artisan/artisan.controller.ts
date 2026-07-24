import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ArtisanService, SubmitQuoteDto } from './artisan.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user.interface';

@UseGuards(JwtAuthGuard)
@Controller('artisans')
export class ArtisanController {
  constructor(private readonly artisanService: ArtisanService) {}

  @Get('me/assignments')
  myAssignments(@CurrentUser() user: AuthUser) {
    return this.artisanService.getMyAssignments(user.artisanId);
  }

  @Post('assignments/:id/respond')
  respond(@Param('id') id: string, @Body('accept') accept: boolean, @CurrentUser() user: AuthUser) {
    return this.artisanService.respondToAssignment(id, user.artisanId, accept);
  }

  @Get('blocks/:blockId/planning')
  planning(@Param('blockId') blockId: string, @CurrentUser() user: AuthUser) {
    return this.artisanService.getBlockPlanning(user.artisanId, blockId);
  }

  @Get('blocks/:blockId/client-contacts')
  contacts(@Param('blockId') blockId: string, @CurrentUser() user: AuthUser) {
    return this.artisanService.getBlockClientContacts(user.artisanId, blockId);
  }

  @Post('blocks/:blockId/quotes')
  submitQuote(
    @Param('blockId') blockId: string,
    @Body() body: SubmitQuoteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.artisanService.submitQuote(user.artisanId, blockId, body);
  }

  @Get('me/quotes')
  myQuotes(@CurrentUser() user: AuthUser) {
    return this.artisanService.getMyQuotes(user.artisanId);
  }
}
