-- CreateTable
CREATE TABLE "BusinessSetting" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "businessName" TEXT,
    "openHour" INTEGER NOT NULL DEFAULT 9,
    "closeHour" INTEGER NOT NULL DEFAULT 23,
    "openDays" TEXT NOT NULL DEFAULT '1,2,3,4,5,6,0',
    "address" TEXT,
    "phone" TEXT,
    "note" TEXT,
    "updatedAt" DATETIME NOT NULL
);
