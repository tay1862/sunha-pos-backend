-- Add identity recovery, PIN lockout, and modifier receipt snapshots.
CREATE TYPE "AuthTokenType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

ALTER TABLE "Employee" ADD COLUMN "pinFailedAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Employee" ADD COLUMN "pinLockedUntil" TIMESTAMP(3);

CREATE TABLE "AuthToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "AuthTokenType" NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");
CREATE INDEX "AuthToken_userId_type_expiresAt_idx" ON "AuthToken"("userId", "type", "expiresAt");
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OrderLineModifier" (
    "id" UUID NOT NULL,
    "orderLineId" UUID NOT NULL,
    "optionId" UUID NOT NULL,
    "nameSnapshot" VARCHAR(80) NOT NULL,
    "priceDeltaSnapshot" BIGINT NOT NULL,
    CONSTRAINT "OrderLineModifier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderLineModifier_orderLineId_optionId_key"
  ON "OrderLineModifier"("orderLineId", "optionId");
CREATE INDEX "OrderLineModifier_optionId_idx" ON "OrderLineModifier"("optionId");
ALTER TABLE "OrderLineModifier" ADD CONSTRAINT "OrderLineModifier_orderLineId_fkey"
  FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderLineModifier" ADD CONSTRAINT "OrderLineModifier_optionId_fkey"
  FOREIGN KEY ("optionId") REFERENCES "ModifierOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
