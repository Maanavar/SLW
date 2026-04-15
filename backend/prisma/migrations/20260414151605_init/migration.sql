-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'admin',
    "passwordHash" VARCHAR(255),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "shortCode" VARCHAR(20) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "hasCommission" BOOLEAN NOT NULL DEFAULT false,
    "requiresDc" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_types" (
    "id" SERIAL NOT NULL,
    "category" VARCHAR(60) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "shortCode" VARCHAR(20) NOT NULL,
    "defaultUnit" VARCHAR(30) NOT NULL,
    "defaultRate" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "workTypeName" VARCHAR(120) NOT NULL,
    "workName" VARCHAR(60),
    "quantity" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "commissionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netAmount" DOUBLE PRECISION,
    "date" VARCHAR(10) NOT NULL,
    "paymentStatus" VARCHAR(20),
    "paymentMode" VARCHAR(20),
    "paidAmount" DOUBLE PRECISION,
    "workMode" VARCHAR(20),
    "isSpotWork" BOOLEAN NOT NULL DEFAULT false,
    "jobCardId" VARCHAR(30),
    "jobCardLine" INTEGER,
    "dcNo" VARCHAR(40),
    "vehicleNo" VARCHAR(40),
    "dcDate" VARCHAR(10),
    "dcApproval" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "paymentMode" VARCHAR(20) NOT NULL,
    "referenceNumber" VARCHAR(60),
    "paymentForMonth" VARCHAR(20),
    "paymentForDate" VARCHAR(10),
    "paymentForFromDate" VARCHAR(10),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" SERIAL NOT NULL,
    "actorUserId" INTEGER,
    "actorName" VARCHAR(120),
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" VARCHAR(50),
    "action" VARCHAR(50) NOT NULL,
    "message" VARCHAR(500),
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");

-- CreateIndex
CREATE INDEX "customers_shortCode_idx" ON "customers"("shortCode");

-- CreateIndex
CREATE INDEX "work_types_name_idx" ON "work_types"("name");

-- CreateIndex
CREATE INDEX "work_types_category_idx" ON "work_types"("category");

-- CreateIndex
CREATE INDEX "jobs_date_idx" ON "jobs"("date");

-- CreateIndex
CREATE INDEX "jobs_customerId_date_idx" ON "jobs"("customerId", "date");

-- CreateIndex
CREATE INDEX "jobs_jobCardId_idx" ON "jobs"("jobCardId");

-- CreateIndex
CREATE INDEX "payments_date_idx" ON "payments"("date");

-- CreateIndex
CREATE INDEX "payments_customerId_date_idx" ON "payments"("customerId", "date");

-- CreateIndex
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_entityType_createdAt_idx" ON "activity_logs"("entityType", "createdAt");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
