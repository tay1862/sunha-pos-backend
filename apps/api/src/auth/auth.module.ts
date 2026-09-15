import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { PrismaService } from '../database/prisma.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService, PrismaAuthRepository } from './auth.service.js';
import { ResendEmailDelivery } from './email.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [
    ResendEmailDelivery,
    {
      provide: AuthService,
      useFactory: (prisma: PrismaService, email: ResendEmailDelivery) =>
        new AuthService(new PrismaAuthRepository(prisma), email),
      inject: [PrismaService, ResendEmailDelivery],
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
