CREATE TABLE "EmployeeSession" (
  "id" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "deviceId" UUID NOT NULL,
  "tokenHash" VARCHAR(128) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmployeeSession_tokenHash_key" UNIQUE ("tokenHash"),
  CONSTRAINT "EmployeeSession_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EmployeeSession_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "EmployeeSession_employeeId_revokedAt_expiresAt_idx" ON "EmployeeSession"("employeeId", "revokedAt", "expiresAt");
CREATE INDEX "EmployeeSession_deviceId_revokedAt_expiresAt_idx" ON "EmployeeSession"("deviceId", "revokedAt", "expiresAt");
