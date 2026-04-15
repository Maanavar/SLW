-- CreateTable
CREATE TABLE "expenses" (
    "id" SERIAL NOT NULL,
    "category" VARCHAR(20) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringDay" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "expenses_recurringDay_check" CHECK ("recurringDay" IS NULL OR ("recurringDay" >= 1 AND "recurringDay" <= 28))
);

-- CreateIndex
CREATE INDEX "expenses_date_idx" ON "expenses"("date");

-- CreateIndex
CREATE INDEX "expenses_category_date_idx" ON "expenses"("category", "date");

-- CreateIndex
CREATE INDEX "expenses_isRecurring_idx" ON "expenses"("isRecurring");
