import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { SetupModule } from './setup/setup.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { OrderModule } from './orders/order.module.js';
import { ShiftModule } from './shifts/shift.module.js';
import { RefundModule } from './refunds/refund.module.js';
import { SyncModule } from './sync/sync.module.js';
import { DeviceModule } from './devices/device.module.js';
import { ReportModule } from './reports/report.module.js';
import { EmployeeModule } from './employees/employee.module.js';
import { PermissionModule } from './auth/permission.module.js';
import { ReceiptModule } from './receipts/receipt.module.js';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    SetupModule,
    CatalogModule,
    InventoryModule,
    OrderModule,
    ShiftModule,
    RefundModule,
    SyncModule,
    DeviceModule,
    ReportModule,
    EmployeeModule,
    PermissionModule,
    ReceiptModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
