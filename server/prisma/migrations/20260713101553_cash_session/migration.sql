-- CreateTable
CREATE TABLE "CashSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "openedById" TEXT NOT NULL,
    "openingCash" REAL NOT NULL DEFAULT 0,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedById" TEXT,
    "countedCash" REAL,
    "variance" REAL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACIK',
    "closedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "CashSession_status_idx" ON "CashSession"("status");

-- CreateIndex
CREATE INDEX "CashSession_openedAt_idx" ON "CashSession"("openedAt");
