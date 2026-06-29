-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "syncGroupId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_syncGroupId_idx" ON "Transaction"("syncGroupId");
