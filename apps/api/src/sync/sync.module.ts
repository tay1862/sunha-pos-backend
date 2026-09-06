import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { OrderModule } from '../orders/order.module.js';
import { ShiftModule } from '../shifts/shift.module.js';
import { SyncController } from './sync.controller.js';
import { SyncService } from './sync.service.js';
@Module({ imports: [DatabaseModule, OrderModule, ShiftModule], controllers: [SyncController], providers: [SyncService] })
export class SyncModule {}
