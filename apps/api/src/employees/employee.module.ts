import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { EmployeeController } from './employee.controller.js';
import { EmployeeService } from './employee.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [EmployeeController],
  providers: [EmployeeService],
  exports: [EmployeeService],
})
export class EmployeeModule {}
