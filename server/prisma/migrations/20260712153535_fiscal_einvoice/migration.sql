-- CreateTable
CREATE TABLE "FiscalReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT,
    "fiscalNo" TEXT NOT NULL,
    "zNo" TEXT,
    "amount" REAL NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OK',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EInvoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT,
    "accountId" TEXT,
    "uuid" TEXT NOT NULL,
    "docType" TEXT NOT NULL DEFAULT 'EARSIV',
    "status" TEXT NOT NULL DEFAULT 'GONDERILDI',
    "total" REAL NOT NULL,
    "provider" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "FiscalReceipt_createdAt_idx" ON "FiscalReceipt"("createdAt");

-- CreateIndex
CREATE INDEX "EInvoice_createdAt_idx" ON "EInvoice"("createdAt");
