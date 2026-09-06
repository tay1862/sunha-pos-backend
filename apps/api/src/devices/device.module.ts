import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { DeviceController } from './device.controller.js';
import { DeviceService } from './device.service.js';
@Module({ imports: [DatabaseModule], controllers: [DeviceController], providers: [DeviceService] })
export class DeviceModule {}
