-- AlterTable
ALTER TABLE "User" ADD COLUMN     "aiOptIn" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "InsightSummary" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsightSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InsightSummary_planId_idx" ON "InsightSummary"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "InsightSummary_planId_month_key" ON "InsightSummary"("planId", "month");

-- AddForeignKey
ALTER TABLE "InsightSummary" ADD CONSTRAINT "InsightSummary_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
