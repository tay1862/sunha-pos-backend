import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { OrderController } from './order.controller.js';
import { OrderService } from './order.service.js';
@Module({ imports: [DatabaseModule], controllers: [OrderController], providers: [OrderService], exports: [OrderService] })
export class OrderModule {}
