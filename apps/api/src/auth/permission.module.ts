import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { PermissionGuard } from './permission.guard.js';

@Global()
@Module({ imports: [DatabaseModule], providers: [PermissionGuard], exports: [PermissionGuard] })
export class PermissionModule {}
