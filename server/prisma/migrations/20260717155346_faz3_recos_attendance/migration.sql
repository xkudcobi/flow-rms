-- CreateTable
CREATE TABLE "StaffRecommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetType" TEXT NOT NULL,
    "targetRole" TEXT,
    "targetUserId" TEXT,
    "targetGroupId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "severity" TEXT NOT NULL DEFAULT 'info',
    "status" TEXT NOT NULL DEFAULT 'BEKLIYOR',
    "dedupeKey" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" DATETIME,
    "seenBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "clockIn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clockOut" DATETIME,
    "workedMinutes" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'QR',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

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
    "attendanceQrEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reviewsRating" REAL,
    "reviewsTotal" INTEGER,
    "reviewsSyncedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BusinessSetting" ("address", "businessName", "closeHour", "id", "note", "openDays", "openHour", "phone", "qrOrderingEnabled", "reviewsRating", "reviewsSyncedAt", "reviewsTotal", "updatedAt") SELECT "address", "businessName", "closeHour", "id", "note", "openDays", "openHour", "phone", "qrOrderingEnabled", "reviewsRating", "reviewsSyncedAt", "reviewsTotal", "updatedAt" FROM "BusinessSetting";
DROP TABLE "BusinessSetting";
ALTER TABLE "new_BusinessSetting" RENAME TO "BusinessSetting";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "StaffRecommendation_dedupeKey_key" ON "StaffRecommendation"("dedupeKey");

-- CreateIndex
CREATE INDEX "StaffRecommendation_status_idx" ON "StaffRecommendation"("status");

-- CreateIndex
CREATE INDEX "StaffRecommendation_targetRole_idx" ON "StaffRecommendation"("targetRole");

-- CreateIndex
CREATE INDEX "Attendance_userId_idx" ON "Attendance"("userId");

-- CreateIndex
CREATE INDEX "Attendance_clockIn_idx" ON "Attendance"("clockIn");
