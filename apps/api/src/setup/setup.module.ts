import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { SetupController } from './setup.controller.js';
import { SetupService } from './setup.service.js';

@Module({ imports: [DatabaseModule], controllers: [SetupController], providers: [SetupService] })
export class SetupModule {}
