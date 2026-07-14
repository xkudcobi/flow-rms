-- AlterTable
ALTER TABLE "Order" ADD COLUMN "mergedLabel" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "originLabel" TEXT;
