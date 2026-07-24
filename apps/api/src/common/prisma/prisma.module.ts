import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * PrismaService exposé en global pour eviter d'avoir à l'importer dans
 * chaque module feature. Le marquer @Global évite aussi l'erreur
 * classique "Nest can't resolve dependencies of X (PrismaService)" en
 * test quand on monte un TestingModule partiel.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
