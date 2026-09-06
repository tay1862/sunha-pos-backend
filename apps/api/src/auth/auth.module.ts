import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { PrismaService } from '../database/prisma.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService, PrismaAuthRepository } from './auth.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [
    {
      provide: AuthService,
      useFactory: (prisma: PrismaService) => new AuthService(new PrismaAuthRepository(prisma)),
      inject: [PrismaService],
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
