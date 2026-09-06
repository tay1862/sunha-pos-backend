import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { RefundController } from './refund.controller.js';
import { RefundService } from './refund.service.js';
@Module({ imports: [DatabaseModule], controllers: [RefundController], providers: [RefundService] })
export class RefundModule {}
