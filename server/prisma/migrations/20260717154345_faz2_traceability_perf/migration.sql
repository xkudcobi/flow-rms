-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "addedById" TEXT;

-- AlterTable
ALTER TABLE "PurchaseItem" ADD COLUMN "expiryDate" DATETIME;
ALTER TABLE "PurchaseItem" ADD COLUMN "origin" TEXT;

-- CreateTable
CREATE TABLE "StockLot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stockItemId" TEXT NOT NULL,
    "purchaseItemId" TEXT,
    "supplierId" TEXT,
    "supplierName" TEXT,
    "origin" TEXT,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" DATETIME,
    "initialQty" REAL NOT NULL,
    "remainingQty" REAL NOT NULL,
    "unitCost" REAL,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockLot_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StockItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'adet',
    "group" TEXT,
    "quantity" REAL NOT NULL DEFAULT 0,
    "criticalLevel" REAL NOT NULL DEFAULT 0,
    "cost" REAL NOT NULL DEFAULT 0,
    "perishable" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_StockItem" ("active", "cost", "createdAt", "criticalLevel", "group", "id", "name", "quantity", "unit", "updatedAt") SELECT "active", "cost", "createdAt", "criticalLevel", "group", "id", "name", "quantity", "unit", "updatedAt" FROM "StockItem";
DROP TABLE "StockItem";
ALTER TABLE "new_StockItem" RENAME TO "StockItem";
CREATE TABLE "new_StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stockItemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "note" TEXT,
    "orderId" TEXT,
    "lotId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "StockLot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StockMovement" ("createdAt", "createdById", "id", "note", "orderId", "quantity", "stockItemId", "type") SELECT "createdAt", "createdById", "id", "note", "orderId", "quantity", "stockItemId", "type" FROM "StockMovement";
DROP TABLE "StockMovement";
ALTER TABLE "new_StockMovement" RENAME TO "StockMovement";
CREATE INDEX "StockMovement_stockItemId_idx" ON "StockMovement"("stockItemId");
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");
CREATE INDEX "StockMovement_lotId_idx" ON "StockMovement"("lotId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "StockLot_stockItemId_idx" ON "StockLot"("stockItemId");

-- CreateIndex
CREATE INDEX "StockLot_expiryDate_idx" ON "StockLot"("expiryDate");
