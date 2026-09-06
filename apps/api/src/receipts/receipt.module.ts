import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ReceiptController } from './receipt.controller.js';
import { ReceiptService } from './receipt.service.js';

@Module({ imports: [DatabaseModule], controllers: [ReceiptController], providers: [ReceiptService] })
export class ReceiptModule {}
