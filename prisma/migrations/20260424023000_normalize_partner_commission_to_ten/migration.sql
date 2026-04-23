UPDATE "users"
SET "commissionRate" = 10.00
WHERE "isPartner" = true
  AND "commissionRate" IS DISTINCT FROM 10.00;

UPDATE "partner_cooperation_contracts"
SET "commissionRate" = 10.00
WHERE "commissionRate" IS DISTINCT FROM 10.00;

UPDATE "cooperation_commission_phases"
SET "commissionRate" = 10.00
WHERE "commissionRate" IS DISTINCT FROM 10.00;
