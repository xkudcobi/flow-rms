-- AlterTable
ALTER TABLE "BusinessSetting" ADD COLUMN "reviewsRating" REAL;
ALTER TABLE "BusinessSetting" ADD COLUMN "reviewsSyncedAt" DATETIME;
ALTER TABLE "BusinessSetting" ADD COLUMN "reviewsTotal" INTEGER;

-- CreateTable
CREATE TABLE "GoogleReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "author" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "time" DATETIME NOT NULL,
    "relativeTime" TEXT,
    "profilePhoto" TEXT,
    "source" TEXT NOT NULL DEFAULT 'google',
    "seen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "GoogleReview_time_idx" ON "GoogleReview"("time");

-- CreateIndex
CREATE INDEX "GoogleReview_seen_idx" ON "GoogleReview"("seen");
