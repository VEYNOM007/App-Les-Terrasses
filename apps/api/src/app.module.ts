import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';

import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ProjectModule } from './modules/project/project.module';
import { ReservationModule } from './modules/reservation/reservation.module';
import { PaymentModule } from './modules/payment/payment.module';
import { ConstructionModule } from './modules/construction/construction.module';
import { PortalModule } from './modules/portal/portal.module';
import { NotificationModule } from './modules/notification/notification.module';
import { ArtisanModule } from './modules/artisan/artisan.module';
import { ContractModule } from './modules/contract/contract.module';
import { LaunchModule } from './modules/launch/launch.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    BullModule.forRoot({ connection: { url: process.env.REDIS_URL } }),
    PrismaModule,
    RedisModule,
    NotificationModule, // global, doit être importé tôt
    AuthModule,
    CatalogModule,
    ProjectModule,
    ReservationModule,
    PaymentModule,
    ConstructionModule,
    PortalModule,
    ArtisanModule,
    ContractModule,
    LaunchModule,
    AdminModule,
  ],
})
export class AppModule {}
