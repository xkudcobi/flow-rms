-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL DEFAULT 'MASA',
    "status" TEXT NOT NULL DEFAULT 'ACIK',
    "tableId" TEXT,
    "openedById" TEXT NOT NULL,
    "note" TEXT,
    "mergedLabel" TEXT,
    "discountType" TEXT,
    "discountValue" REAL NOT NULL DEFAULT 0,
    "discountReason" TEXT,
    "tip" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "closedAt" DATETIME,
    CONSTRAINT "Order_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("closedAt", "createdAt", "discountReason", "discountType", "discountValue", "id", "mergedLabel", "note", "openedById", "status", "tableId", "type", "updatedAt") SELECT "closedAt", "createdAt", "discountReason", "discountType", "discountValue", "id", "mergedLabel", "note", "openedById", "status", "tableId", "type", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE INDEX "Order_tableId_idx" ON "Order"("tableId");
CREATE INDEX "Order_status_idx" ON "Order"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
