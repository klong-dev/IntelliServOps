-- Store electricity/water tiered pricing separately from meters.
CREATE TYPE "UtilityRateScope" AS ENUM ('global', 'apartment', 'meter', 'contract');

CREATE TYPE "UtilityRatePlanStatus" AS ENUM ('active', 'inactive', 'archived');

CREATE TABLE "utility_rate_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "meterType" "MeterType" NOT NULL,
    "scopeType" "UtilityRateScope" NOT NULL DEFAULT 'global',
    "scopeId" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" "UtilityRatePlanStatus" NOT NULL DEFAULT 'active',
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "tiers" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "utility_rate_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "utility_rate_plans_meterType_idx" ON "utility_rate_plans"("meterType");
CREATE INDEX "utility_rate_plans_scopeType_scopeId_idx" ON "utility_rate_plans"("scopeType", "scopeId");
CREATE INDEX "utility_rate_plans_effectiveFrom_idx" ON "utility_rate_plans"("effectiveFrom");
CREATE INDEX "utility_rate_plans_effectiveTo_idx" ON "utility_rate_plans"("effectiveTo");
CREATE INDEX "utility_rate_plans_status_idx" ON "utility_rate_plans"("status");
