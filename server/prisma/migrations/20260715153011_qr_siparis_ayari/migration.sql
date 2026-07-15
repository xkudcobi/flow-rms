-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BusinessSetting" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "businessName" TEXT,
    "openHour" INTEGER NOT NULL DEFAULT 9,
    "closeHour" INTEGER NOT NULL DEFAULT 23,
    "openDays" TEXT NOT NULL DEFAULT '1,2,3,4,5,6,0',
    "address" TEXT,
    "phone" TEXT,
    "note" TEXT,
    "qrOrderingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reviewsRating" REAL,
    "reviewsTotal" INTEGER,
    "reviewsSyncedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BusinessSetting" ("address", "businessName", "closeHour", "id", "note", "openDays", "openHour", "phone", "reviewsRating", "reviewsSyncedAt", "reviewsTotal", "updatedAt") SELECT "address", "businessName", "closeHour", "id", "note", "openDays", "openHour", "phone", "reviewsRating", "reviewsSyncedAt", "reviewsTotal", "updatedAt" FROM "BusinessSetting";
DROP TABLE "BusinessSetting";
ALTER TABLE "new_BusinessSetting" RENAME TO "BusinessSetting";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
