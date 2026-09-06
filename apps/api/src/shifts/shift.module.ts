import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ShiftController } from './shift.controller.js';
import { ShiftService } from './shift.service.js';
@Module({ imports: [DatabaseModule], controllers: [ShiftController], providers: [ShiftService] })
export class ShiftModule {}
