ALTER TABLE "SyncOperation"
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastError" VARCHAR(300),
  ADD COLUMN "nextRetryAt" TIMESTAMP(3),
  ADD COLUMN "lastAttemptAt" TIMESTAMP(3);

CREATE INDEX "SyncOperation_tenantId_nextRetryAt_idx"
  ON "SyncOperation"("tenantId", "nextRetryAt");
