-- CreateTable
CREATE TABLE "RecurringSkip" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ym" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringSkip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringSkip_ruleId_idx" ON "RecurringSkip"("ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringSkip_ruleId_ym_key" ON "RecurringSkip"("ruleId", "ym");

-- AddForeignKey
ALTER TABLE "RecurringSkip" ADD CONSTRAINT "RecurringSkip_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "RecurringRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
