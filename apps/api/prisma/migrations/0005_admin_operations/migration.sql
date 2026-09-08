ALTER TABLE "Tenant" ADD COLUMN "suspendedAt" TIMESTAMP(3);

CREATE INDEX "Tenant_suspendedAt_idx" ON "Tenant"("suspendedAt");
