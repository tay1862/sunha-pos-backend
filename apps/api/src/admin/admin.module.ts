import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { AdminAuthGuard } from './admin-auth.guard.js';

@Module({ controllers: [AdminController], providers: [AdminService, AdminAuthGuard] })
export class AdminModule {}
