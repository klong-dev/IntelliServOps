-- Remove over-engineered tiered utility rate plans.
DROP TABLE IF EXISTS "utility_rate_plans";
DROP TYPE IF EXISTS "UtilityRatePlanStatus";
DROP TYPE IF EXISTS "UtilityRateScope";
