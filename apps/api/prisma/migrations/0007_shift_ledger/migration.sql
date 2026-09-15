ALTER TABLE "Order" ADD COLUMN "shiftId" UUID;
ALTER TABLE "Payment" ADD COLUMN "shiftId" UUID;
ALTER TABLE "Refund" ADD COLUMN "shiftId" UUID;
CREATE INDEX "Order_shiftId_createdAt_idx" ON "Order"("shiftId", "createdAt");
CREATE INDEX "Payment_shiftId_createdAt_idx" ON "Payment"("shiftId", "createdAt");
CREATE INDEX "Refund_shiftId_createdAt_idx" ON "Refund"("shiftId", "createdAt");
ALTER TABLE "Order" ADD CONSTRAINT "Order_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
