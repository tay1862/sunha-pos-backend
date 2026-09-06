import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ReportController } from './report.controller.js';
import { ReportService } from './report.service.js';
@Module({ imports: [DatabaseModule], controllers: [ReportController], providers: [ReportService] })
export class ReportModule {}
