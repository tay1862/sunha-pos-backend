DROP INDEX "Shift_storeId_isOpen_key";
CREATE UNIQUE INDEX "Shift_one_open_per_store" ON "Shift" ("storeId") WHERE "isOpen" = true;
