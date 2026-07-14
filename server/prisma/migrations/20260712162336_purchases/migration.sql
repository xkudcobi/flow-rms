-- AlterTable
ALTER TABLE "Account" ADD COLUMN "address" TEXT;
ALTER TABLE "Account" ADD COLUMN "email" TEXT;
ALTER TABLE "Account" ADD COLUMN "iban" TEXT;
ALTER TABLE "Account" ADD COLUMN "taxNumber" TEXT;
ALTER TABLE "Account" ADD COLUMN "taxOffice" TEXT;

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT,
    "invoiceNo" TEXT,
    "invoiceDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT,
    "note" TEXT,
    "subtotal" REAL NOT NULL DEFAULT 0,
    "vatTotal" REAL NOT NULL DEFAULT 0,
    "grandTotal" REAL NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PESIN',
    "paymentMethod" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseId" TEXT NOT NULL,
    "stockItemId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'adet',
    "unitPrice" REAL NOT NULL,
    "vatRate" REAL NOT NULL DEFAULT 0,
    "lineNet" REAL NOT NULL,
    "lineVat" REAL NOT NULL,
    "lineTotal" REAL NOT NULL,
    CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StockItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'adet',
    "quantity" REAL NOT NULL DEFAULT 0,
    "criticalLevel" REAL NOT NULL DEFAULT 0,
    "cost" REAL NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_StockItem" ("active", "createdAt", "criticalLevel", "id", "name", "quantity", "unit", "updatedAt") SELECT "active", "createdAt", "criticalLevel", "id", "name", "quantity", "unit", "updatedAt" FROM "StockItem";
DROP TABLE "StockItem";
ALTER TABLE "new_StockItem" RENAME TO "StockItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Purchase_invoiceDate_idx" ON "Purchase"("invoiceDate");

-- CreateIndex
CREATE INDEX "Purchase_supplierId_idx" ON "Purchase"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseItem_purchaseId_idx" ON "PurchaseItem"("purchaseId");
