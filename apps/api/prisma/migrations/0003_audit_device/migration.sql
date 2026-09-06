ALTER TABLE "AuditEvent" ADD COLUMN "deviceId" UUID;

ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AuditEvent_deviceId_idx" ON "AuditEvent"("deviceId");
